"""Local isolated HTTP regression. Creates random @example.invalid QA users; deletes all its own rows in finally.
No real payment or email; no browser; uses actual rendered server-action forms.
"""
import requests,sqlite3,secrets,datetime,json,re,subprocess
from bs4 import BeautifulSoup
BASE='http://127.0.0.1:3100'
db=sqlite3.connect('prisma/dev.db');db.row_factory=sqlite3.Row
run='qa-'+secrets.token_hex(6);pw=secrets.token_urlsafe(24);pw2=secrets.token_urlsafe(24)
emails=[run+'@example.invalid',run+'-admin@example.invalid'];results=[];ids=[]
def check(name,cond,extra=''):
 results.append({'test':name,'pass':bool(cond),'evidence':extra});print(('PASS' if cond else 'FAIL'),name,extra)
 if not cond:raise AssertionError(name)
def session():
 s=requests.Session();s.headers.update({'Origin':BASE});return s
def call(s,path,body=None,headers=None):
 r=s.post(BASE+path,json=body,headers=headers or {})
 # Production correctly sets Secure cookie. Local HTTP harness explicitly opts into forwarding for loopback tests only.
 for c in s.cookies:c.secure=False
 return r
def form(s,path,selector,values):
 r=s.get(BASE+path);check('render form '+path,r.status_code==200,str(r.status_code));soup=BeautifulSoup(r.text,'html.parser');f=selector(soup)
 if not f:raise AssertionError('missing form '+path)
 fields={}
 for i in f.select('input[name]'):
  if i.get('type') in ['checkbox','radio'] and not i.has_attr('checked'):continue
  fields[i['name']]=i.get('value','')
 for sel in f.select('select[name]'):
  opt=sel.select_one('option[selected]') or sel.select_one('option');fields[sel['name']]=opt.get('value','') if opt else ''
 fields.update(values)
 r=s.post(BASE+path,files=[(k,(None,str(v))) for k,v in fields.items()],allow_redirects=False)
 for c in s.cookies:c.secure=False
 return r
try:
 before={t:db.execute('select count(*) from "'+t+'"').fetchone()[0] for t in ['Series','User','Order','Subscription']}
 u=session();a=session();anon=session()
 check('CSRF cross-site signup denied',anon.post(BASE+'/api/auth/signup',json={'email':emails[0],'password':pw},headers={'Origin':'https://evil.invalid'}).status_code==403)
 check('invalid email rejected',call(u,'/api/auth/signup',{'email':'bad','password':pw}).status_code==400)
 check('short password rejected',call(u,'/api/auth/signup',{'email':emails[0],'password':'short'}).status_code==400)
 check('register real account',call(u,'/api/auth/signup',{'email':emails[0],'name':'QA User','password':pw}).status_code==200)
 row=db.execute('select * from User where email=?',(emails[0],)).fetchone();uid=row['id'];ids.append(uid)
 check('bcrypt hash stored, never plaintext',row['passwordHash'].startswith('$2') and row['passwordHash']!=pw)
 check('duplicate signup rejected',call(u,'/api/auth/signup',{'email':emails[0],'password':pw}).status_code==409)
 check('wrong password rejected',call(u,'/api/auth/login',{'email':emails[0],'password':'wrong-password'}).status_code==401)
 check('login success',call(u,'/api/auth/login',{'email':emails[0],'password':pw}).status_code==200)
 check('account center works',u.get(BASE+'/account').status_code==200)
 r=u.get(BASE+'/login?next=//evil.invalid',allow_redirects=False);check('server open redirect blocked',r.status_code==307 and r.headers.get('Location')=='/account',r.headers.get('Location',''))
 r=u.get(BASE+'/signup?next=//evil.invalid',allow_redirects=False);check('signup redirect also blocked',r.status_code==307 and r.headers.get('Location')=='/account')
 check('ordinary user cannot open admin',u.get(BASE+'/admin/users',allow_redirects=False).status_code in [303,307])
 check('ordinary user cannot upload',u.post(BASE+'/api/admin/upload',allow_redirects=False).status_code in [303,307,401,403])
 # Temporary QA admin, no existing admin credential access.
 check('register isolated QA admin',call(a,'/api/auth/signup',{'email':emails[1],'name':'QA Operator','password':pw}).status_code==200)
 ar=db.execute('select id from User where email=?',(emails[1],)).fetchone();aid=ar['id'];ids.append(aid)
 db.execute('update User set role="admin" where id=?',(aid,));db.commit()
 check('operator login',call(a,'/api/auth/login',{'email':emails[1],'password':pw}).status_code==200)
 for path in ['/admin','/admin/users?q='+run,'/admin/members','/admin/users/'+uid,'/admin/promos','/admin/home','/admin/categories','/admin/storage','/admin/payments']:
  r=a.get(BASE+path);check('admin page '+path,r.status_code==200,str(r.status_code))
 # Select first paid episode. Only inspect data for test IDs; never print secrets.
 ep=db.execute('select e.id,e.number,s.slug from Episode e join Series s on s.id=e.seriesId where e.isFree=0 and e.isPublished=1 and s.status="published" limit 1').fetchone();eid=ep['id']
 check('paid playback denied before purchase',u.get(BASE+'/api/playback/'+eid,headers={'Range':'bytes=0-99'}).status_code==403)
 check('raw local video URL is blocked',anon.get(BASE+'/uploads/videos/clip-a.mp4',headers={'Range':'bytes=0-99'}).status_code==403)
 plan=db.execute('select id from Plan where isEnabled=1 order by sortOrder limit 1').fetchone()['id'];key=secrets.token_hex(16)
 body={'planId':plan,'next':'/watch/'+ep['slug']+'/'+str(ep['number'])};hdr={'Idempotency-Key':key}
 check('missing checkout key rejected',call(u,'/api/checkout/demo',body).status_code==400)
 r=call(u,'/api/checkout/demo',body,hdr);check('Demo purchase succeeds',r.status_code==200,str(r.status_code));oid=r.json()['orderId']
 check('VIP unlocks paid video',u.get(BASE+'/api/playback/'+eid,headers={'Range':'bytes=0-99'}).status_code==206)
 rr=call(u,'/api/checkout/demo',body,hdr);check('repeat purchase same key same order',rr.status_code==200 and rr.json()['orderId']==oid)
 check('single order entitlement',db.execute('select count(*) from Subscription where orderId=?',(oid,)).fetchone()[0]==1)
 check('receipt is own verified Demo', 'Demo complete' in u.get(BASE+r.json()['redirect']).text)
 check('receipt IDOR denied', 'Demo complete' not in a.get(BASE+'/checkout/success?orderId='+oid).text)
 controls=lambda soup:soup.find('select',attrs={'name':'action'}).find_parent('form')
 memberpath='/admin/users/'+uid
 oldend=db.execute('select max(endsAt) from Subscription where userId=?',(uid,)).fetchone()[0]
 r=form(a,memberpath,controls,{'action':'extend','days':'7','planId':plan,'reason':'QA isolated extension'})
 check('admin extend through actual server action',r.status_code in [200,303],str(r.status_code))
 newend=db.execute('select max(endsAt) from Subscription where userId=?',(uid,)).fetchone()[0];check('extension increases expiry 7d',newend-oldend==7*86400000)
 # Reuse the exact action on a PUBLIC page as an ordinary user: guard must still refuse.
 page=a.get(BASE+memberpath);f=controls(BeautifulSoup(page.text,'html.parser'));action=f.select_one('input[name^="$ACTION_ID_"]')
 r=u.post(BASE+'/account',files=[(action['name'],(None,'')),('userId',(None,uid)),('action',(None,'grant')),('days',(None,'99')),('planId',(None,plan)),('reason',(None,'forged'))],allow_redirects=False)
 check('server action role guard blocks privilege escalation',db.execute('select max(endsAt) from Subscription where userId=?',(uid,)).fetchone()[0]==newend,str(r.status_code))
 r=form(a,memberpath,controls,{'action':'revoke','days':'1','planId':plan,'reason':'QA isolated revocation'})
 check('admin revoke through actual server action',r.status_code in [200,303])
 check('revocation blocks next video request immediately',u.get(BASE+'/api/playback/'+eid,headers={'Range':'bytes=0-99'}).status_code==403)
 rr=call(u,'/api/checkout/demo',body,hdr);check('replayed paid callback does not restore revoked VIP',rr.status_code==200 and u.get(BASE+'/api/playback/'+eid,headers={'Range':'bytes=0-99'}).status_code==403)
 r=form(a,memberpath,controls,{'action':'grant','days':'1','planId':plan,'reason':'QA restore'});check('admin regrant unlocks',u.get(BASE+'/api/playback/'+eid,headers={'Range':'bytes=0-99'}).status_code==206)
 db.execute('update Subscription set endsAt=? where userId=?',(int(datetime.datetime.now().timestamp()*1000)-1000,uid));db.commit()
 check('expiry blocks next request immediately',u.get(BASE+'/api/playback/'+eid,headers={'Range':'bytes=0-99'}).status_code==403)
 r=form(a,memberpath,controls,{'action':'grant','days':'1','planId':plan,'reason':'QA restore before ban'})
 ban=lambda soup:soup.find('input',attrs={'name':'id','value':uid}).find_parent('form')
 r=form(a,'/admin/users?q='+run,ban,{})
 check('ban immediately blocks stale JWT',call(u,'/api/progress',{'episodeId':eid,'progressSec':1}).status_code==401)
 check('banned account login denied',call(u,'/api/auth/login',{'email':emails[0],'password':pw}).status_code==403)
 r=form(a,'/admin/users?q='+run,ban,{})
 check('unban requires fresh login',call(u,'/api/progress',{'episodeId':eid,'progressSec':1}).status_code==401)
 check('restored account can login',call(u,'/api/auth/login',{'email':emails[0],'password':pw}).status_code==200)
 check('restored account playback works',u.get(BASE+'/api/playback/'+eid,headers={'Range':'bytes=0-99'}).status_code==206)
 r=form(u,'/account/settings',lambda soup:soup.find('input',attrs={'name':'name'}).find_parent('form'),{'name':'Updated QA'})
 check('profile change persisted',db.execute('select name from User where id=?',(uid,)).fetchone()[0]=='Updated QA')
 oldsession=u.cookies.get('lumereel_session');r=form(u,'/account/settings',lambda soup:soup.find('input',attrs={'name':'current'}).find_parent('form'),{'current':pw,'password':pw2,'confirm':pw2})
 check('password change works',call(u,'/api/auth/login',{'email':emails[0],'password':pw2}).status_code==200)
 stale=session();stale.cookies.set('lumereel_session',oldsession)
 check('old session invalid after password change',call(stale,'/api/progress',{'episodeId':eid,'progressSec':1}).status_code==401)
 check('old password rejected',call(u,'/api/auth/login',{'email':emails[0],'password':pw}).status_code==401)
 prev=u.cookies.get('lumereel_session');check('logout works',call(u,'/api/auth/logout',{}).status_code==200)
 loggedout=session();loggedout.cookies.set('lumereel_session',prev)
 check('logout revokes previous token',call(loggedout,'/api/progress',{'episodeId':eid}).status_code==401)
 check('member actions have audit trail',db.execute('select count(*) from AdminAudit where userId=?',(uid,)).fetchone()[0]>=5)
except Exception as e:
 results.append({'test':'suite finished','pass':False,'evidence':str(e)});print('SUITE ERROR',type(e).__name__,str(e))
finally:
 # QA users cascade orders/entitlements/history; remove independent rows explicitly.
 for email in emails:
  row=db.execute('select id from User where email=?',(email,)).fetchone()
  if row and row['id'] not in ids:ids.append(row['id'])
 for id in ids:
  db.execute('delete from CheckoutRequest where userId=?',(id,));db.execute('delete from AdminAudit where userId=? or actorId=?',(id,id))
  for t in ['Subscription','Order','WatchHistory','EpisodeUnlock','MyListItem','Review']:
   db.execute('delete from "'+t+'" where userId=?',(id,))
  db.execute('delete from User where id=?',(id,))
 db.commit()
 after={t:db.execute('select count(*) from "'+t+'"').fetchone()[0] for t in ['Series','User','Order','Subscription']}
 results.append({'test':'isolated QA rows removed / original counts preserved','pass':before==after,'evidence':str({'before':before,'after':after})})
 report={'timeAsiaShanghai':datetime.datetime.now().isoformat(),'tests':results,'pass':all(x['pass'] for x in results)}
 open('test-results/auth-members.json','w').write(json.dumps(report,ensure_ascii=False,indent=2));print('REPORT',report['pass'],'tests',len(results),'counts',after)
 if not report['pass']:raise SystemExit(1)
