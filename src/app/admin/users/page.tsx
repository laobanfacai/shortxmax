import { UserDirectory } from "@/components/admin/UserDirectory";
export default async function Users({searchParams}:{searchParams:Promise<{q?:string;status?:string;vip?:string;page?:string}>}) {return <div><h1 className="admin-title">用户管理</h1><p className="admin-hint">搜索、筛选和分页。点击用户进入订单、观看记录、金币与会员管理。所有修改都经过管理员鉴权。</p><UserDirectory sp={await searchParams}/></div>;}
