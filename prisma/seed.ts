import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const clips = [
  "/uploads/videos/clip-a.mp4",
  "/uploads/videos/clip-b.mp4",
  "/uploads/videos/clip-c.mp4",
  "/uploads/videos/clip-d.mp4",
];

type SeedShow = {
  slug: string;
  title: string;
  hook: string;
  synopsis: string;
  genre: string;
  tags: string[];
  rating: number;
  ratingCount: number;
  viewCount: number;
  freeEpisodeCount: number;
  isTrending: boolean;
  isNew: boolean;
  sortOrder: number;
  episodes: { title: string; synopsis: string }[];
  reviews: { name: string; rating: number; body: string }[];
};

const shows: SeedShow[] = [
  {
    slug: "velvet-contract",
    title: "The Velvet Contract",
    hook: "She signed a one-year marriage contract. She didn't sign up to fall for him.",
    synopsis:
      "When struggling designer Lila Chen agrees to become the contract wife of ice-cold CEO Adrian Vale, she thinks it's a simple year of public appearances in exchange for saving her mother's clinic. But Vale Group's board is circling, an ex-fiancée wants her gone, and Adrian's carefully buried heart is the one clause she can't negotiate.",
    genre: "ceo-romance",
    tags: ["contract marriage", "billionaire", "workplace", "slow burn"],
    rating: 4.9,
    ratingCount: 18420,
    viewCount: 2410000,
    freeEpisodeCount: 3,
    isTrending: true,
    isNew: true,
    sortOrder: 1,
    episodes: [
      { title: "The Contract", synopsis: "Lila signs. Adrian does not smile." },
      { title: "First Appearance", synopsis: "The cameras love them. The ex does not." },
      { title: "The Ex", synopsis: "A champagne toast turns into a warning." },
      { title: "Office Rumor", synopsis: "The intern floor already knows her name." },
      { title: "A Kiss for the Cameras", synopsis: "It was supposed to be staged." },
      { title: "Her Mother's Debt", synopsis: "The clinic's ledger has a new signature." },
      { title: "The Boardroom Ambush", synopsis: "They try to vote the wife out." },
      { title: "Night in Milan", synopsis: "A balcony, a confession, a mistake." },
      { title: "The Clause He Hid", synopsis: "Page fourteen was never about the clinic." },
      { title: "Jealousy", synopsis: "Adrian learns he is not as ice-cold as billed." },
      { title: "Tear It Up", synopsis: "Lila walks. The contract does not." },
      { title: "Sign Forever", synopsis: "A new document. No end date." },
    ],
    reviews: [
      { name: "Maya R.", rating: 5, body: "I said I'd watch one free episode. I finished the season and upgraded before the lock screen faded." },
      { name: "Chris P.", rating: 5, body: "The Milan episode ruined me. Contract marriage done right." },
    ],
  },
  {
    slug: "the-last-laugh",
    title: "The Last Laugh",
    hook: "They took everything from her. She came back for the encore.",
    synopsis:
      "After her husband's family frames her and leaves her with nothing but a rain-slick driveway and a burning estate in the rearview, Seraphine Cole disappears. One year later she returns as the woman they cannot afford to ignore — with a smile, a new name, and a plan to take the house, the company, and the last word.",
    genre: "revenge",
    tags: ["revenge", "betrayal", "luxury", "family secrets"],
    rating: 4.8,
    ratingCount: 22110,
    viewCount: 3120000,
    freeEpisodeCount: 2,
    isTrending: true,
    isNew: false,
    sortOrder: 2,
    episodes: [
      { title: "The Driveway", synopsis: "She walks away from the fire." },
      { title: "A New Name", synopsis: "The city learns to say it carefully." },
      { title: "Invitation Only", synopsis: "She arrives where they thought she was buried." },
      { title: "The Toast", synopsis: "He raises a glass. She ruins the night." },
      { title: "Paper Cuts", synopsis: "Shares disappear one signature at a time." },
      { title: "The Mistress", synopsis: "An ally in a silk dress has her own ledger." },
      { title: "Old Keys", synopsis: "The estate still knows her footsteps." },
      { title: "Public Ruin", synopsis: "The press conference does not go as they planned." },
      { title: "The Last Witness", synopsis: "Someone in the family wants to talk." },
      { title: "Encore", synopsis: "She takes a bow. The house is hers." },
    ],
    reviews: [
      { name: "Ivy Chen", rating: 5, body: "The opening shot alone is worth the free episodes. The rest is delicious." },
      { name: "Sam K.", rating: 4, body: "Cold, stylish, and mean in the best way." },
    ],
  },
  {
    slug: "moonlit-claim",
    title: "Moonlit Claim",
    hook: "He felt the bond the night he swore he would never take a mate.",
    synopsis:
      "Kade Rowan has kept the pack together by refusing the one thing they all expect: a mate. Then a stranger walks the forest road under a full moon, and the claim hits him like a second pulse. Elara didn't come looking for a bond. The rival pack did.",
    genre: "werewolf",
    tags: ["fated mates", "alpha", "slow burn", "pack politics"],
    rating: 4.8,
    ratingCount: 15640,
    viewCount: 1980000,
    freeEpisodeCount: 4,
    isTrending: true,
    isNew: true,
    sortOrder: 3,
    episodes: [
      { title: "The Forest Road", synopsis: "A scent on the wind changes the map." },
      { title: "He Won't Say It", synopsis: "The pack already knows." },
      { title: "Guest of the Alpha", synopsis: "Elara is given a room, not a choice." },
      { title: "Moonrise", synopsis: "The bond does not ask permission." },
      { title: "Rival Scent", synopsis: "Another pack has been watching her." },
      { title: "The Trial", synopsis: "To stay, she has to run." },
      { title: "Blood on Silver", synopsis: "A challenge under the trees." },
      { title: "What He Buried", synopsis: "Kade's last mate was a rumor for a reason." },
      { title: "Her Choice", synopsis: "The claim is not a cage unless she lets it be." },
      { title: "Pack Fire", synopsis: "The border does not hold." },
      { title: "The Howl", synopsis: "They answer together." },
      { title: "Kept", synopsis: "A bond, freely taken." },
    ],
    reviews: [
      { name: "Lena", rating: 5, body: "The moon, the tension, the walk-away — this is the werewolf short I wanted." },
      { name: "Noah", rating: 5, body: "Episode four hooked me. VIP was an easy yes." },
    ],
  },
  {
    slug: "never-the-maid",
    title: "She Was Never the Maid",
    hook: "They rang for tea. She took off the apron and put on the family diamonds.",
    synopsis:
      "For three years, Aria Vale has poured coffee in the house that stole her name. The family believes she is nobody. The bloodline papers in a locked drawer say otherwise. On the night of the spring gala, Aria stops pretending — and the people who treated her like furniture learn what the crest on the wall actually means.",
    genre: "hidden-identity",
    tags: ["hidden heiress", "identity reveal", "family", "class"],
    rating: 4.7,
    ratingCount: 13200,
    viewCount: 1760000,
    freeEpisodeCount: 3,
    isTrending: false,
    isNew: true,
    sortOrder: 4,
    episodes: [
      { title: "The Apron", synopsis: "She irons a dress she used to own." },
      { title: "The Locked Drawer", synopsis: "A key she was never supposed to find." },
      { title: "Gala Night", synopsis: "The necklace comes out of hiding." },
      { title: "Who Is She?", synopsis: "The foyer goes silent." },
      { title: "The Will", synopsis: "Lawyers arrive earlier than expected." },
      { title: "His Apology", synopsis: "The son of the house has more to lose." },
      { title: "A Seat at the Table", synopsis: "She does not sit where they point." },
      { title: "The Forgery", synopsis: "Someone altered the bloodline file." },
      { title: "Press Conference", synopsis: "The crest is back in the papers." },
      { title: "Her House", synopsis: "The maid's door is no longer hers." },
    ],
    reviews: [
      { name: "Priya", rating: 5, body: "The reveal in the foyer lives in my head rent-free." },
      { name: "Owen", rating: 4, body: "Classic hidden identity, gorgeous rooms, sharp dialogue." },
    ],
  },
  {
    slug: "billion-dollar-vow",
    title: "The Billion-Dollar Vow",
    hook: "He needed a wife by Friday. She needed a reason not to walk.",
    synopsis:
      "Alexander Hart has a shareholders' meeting, a jealous board, and a vow he made in public that he would be married before the quarter closed. Studio intern Noa Reyes was only supposed to deliver a contract. By sunset she is wearing a ring that costs more than her student debt — and learning that Hart men do not bluff, even when they are falling.",
    genre: "billionaire",
    tags: ["billionaire", "forced proximity", "office romance", "marriage of convenience"],
    rating: 4.8,
    ratingCount: 16990,
    viewCount: 2210000,
    freeEpisodeCount: 3,
    isTrending: true,
    isNew: false,
    sortOrder: 5,
    episodes: [
      { title: "By Friday", synopsis: "The calendar is not a suggestion." },
      { title: "The Intern", synopsis: "Noa brings coffee and leaves with a ring." },
      { title: "Penthouse Rules", synopsis: "There is a rider for everything except feelings." },
      { title: "The Meeting", synopsis: "She smiles for the board. They blink first." },
      { title: "His Mother", synopsis: "The real interview happens at dinner." },
      { title: "A Leak", synopsis: "Someone sells the marriage to a tabloid." },
      { title: "Stay the Night", synopsis: "The guest room is suddenly unavailable." },
      { title: "The Offer", synopsis: "They try to buy her out." },
      { title: "Noa's Price", synopsis: "She names something money cannot cover." },
      { title: "Shareholders", synopsis: "He chooses her in a room full of men." },
      { title: "The Vow, Rewritten", synopsis: "No expiration date this time." },
      { title: "Ours", synopsis: "The terrace at golden hour." },
    ],
    reviews: [
      { name: "Jordan", rating: 5, body: "I was not okay. Worth every cent of the monthly plan." },
      { name: "Hana", rating: 5, body: "Golden-hour terrace, icy CEO, intern with a spine. Perfect." },
    ],
  },
  {
    slug: "bride-by-midnight",
    title: "Bride by Midnight",
    hook: "The veil was meant for her sister. The groom knew — and married her anyway.",
    synopsis:
      "When the real bride disappears an hour before a merger wedding, quieter sister Eden Hall is asked to put on the veil 'just until midnight.' Groom and hotel heir Lucien Graves lets the ceremony stand. By morning the papers are signed, the sister is back, and Lucien has no intention of letting Eden out of the chapel story they started.",
    genre: "ceo-romance",
    tags: ["substitute bride", "forced marriage", "siblings", "hotel empire"],
    rating: 4.7,
    ratingCount: 11880,
    viewCount: 1540000,
    freeEpisodeCount: 4,
    isTrending: false,
    isNew: true,
    sortOrder: 6,
    episodes: [
      { title: "The Missing Bride", synopsis: "A veil, a sister, a clock." },
      { title: "Say It Anyway", synopsis: "Lucien does not stop the priest." },
      { title: "After Midnight", synopsis: "The suite has one bed and too many questions." },
      { title: "Headlines", synopsis: "The world thinks the wedding was always hers." },
      { title: "The Real One Returns", synopsis: "She wants the ring back." },
      { title: "Hotel War", synopsis: "The merger has a new clause: Eden." },
      { title: "A Dance in Public", synopsis: "He holds her like he meant it." },
      { title: "The Letter", synopsis: "Why the first bride ran." },
      { title: "Eden's Exit", synopsis: "She tries to be a footnote." },
      { title: "Keep the Veil", synopsis: "Lucien rewrites the guest list." },
    ],
    reviews: [
      { name: "Elise", rating: 5, body: "The chapel lighting. The almost-confession. I gasped." },
      { name: "Ben", rating: 4, body: "Substitute bride trope executed with taste." },
    ],
  },
  {
    slug: "ashes-of-her-name",
    title: "Ashes of Her Name",
    hook: "They burned the estate. They forgot she still had the locket.",
    synopsis:
      "After the fire, everyone said the last Ashford daughter was gone. They were wrong. Rain-soaked and nameless, Evelyn walks back into the city with a charred locket and a list of men who signed the insurance papers. The ruins remember her. So will they.",
    genre: "revenge",
    tags: ["revenge", "inheritance", "fire", "identity"],
    rating: 4.6,
    ratingCount: 9870,
    viewCount: 1320000,
    freeEpisodeCount: 2,
    isTrending: false,
    isNew: false,
    sortOrder: 7,
    episodes: [
      { title: "Rain on Stone", synopsis: "The ruins still smell like her childhood." },
      { title: "The Locket", synopsis: "A face inside the gold, and a name they erased." },
      { title: "Insurance", synopsis: "Someone got paid for the fire." },
      { title: "A Room in Town", synopsis: "She takes a job in the enemy's lobby." },
      { title: "The List", synopsis: "Five signatures. One night each." },
      { title: "Old Photograph", synopsis: "The portrait on the wall was always a lie." },
      { title: "Smoke Again", synopsis: "They try to finish what they started." },
      { title: "Her Testimony", synopsis: "The court finally hears the name." },
      { title: "The Last Signature", synopsis: "He thought the ink was dry." },
      { title: "Rebuild", synopsis: "The estate is a scar, and it is hers." },
      { title: "Ashford", synopsis: "She says it out loud." },
    ],
    reviews: [
      { name: "Rita", rating: 5, body: "Darker than The Last Laugh, just as stylish. That locket scene." },
      { name: "Cole", rating: 4, body: "Moody, rainy, relentless. I stayed up." },
    ],
  },
  {
    slug: "rejected-mate",
    title: "The Alpha's Rejected Mate",
    hook: "He turned his back in the clearing. The moon did not.",
    synopsis:
      "Rowan Voss rejects his mate in front of the pack because a rival alliance demands a different bride. Calla walks out of the trees with her heart in pieces and a power neither of them understood. Weeks later the bond is still there — and so is the war he thought he could marry his way out of.",
    genre: "werewolf",
    tags: ["rejected mate", "second chance", "alpha", "hurt/comfort"],
    rating: 4.9,
    ratingCount: 20340,
    viewCount: 2890000,
    freeEpisodeCount: 5,
    isTrending: true,
    isNew: false,
    sortOrder: 8,
    episodes: [
      { title: "The Clearing", synopsis: "He walks away. She does not beg." },
      { title: "After the Moon", synopsis: "The bond hurts in both directions." },
      { title: "A Different Bride", synopsis: "The alliance arrives with flowers and knives." },
      { title: "Calla's Gift", synopsis: "The pack healer was never only a healer." },
      { title: "He Looks Back", synopsis: "Too late, and not late enough." },
      { title: "The Border", synopsis: "War does not care about weddings." },
      { title: "Her New Pack", synopsis: "Someone else offers her a home." },
      { title: "The Challenge", synopsis: "Rowan can reject a mate. He cannot reject a fight." },
      { title: "Blood Promise", synopsis: "She will not be claimed twice without asking." },
      { title: "What He Should Have Said", synopsis: "A confession in the rain." },
      { title: "Choose", synopsis: "The moon waits." },
      { title: "Stay", synopsis: "This time he does not turn away." },
    ],
    reviews: [
      { name: "Sofia", rating: 5, body: "The rejection scene wrecked me. The return put me back together." },
      { name: "Marcus", rating: 5, body: "Best werewolf short on the platform. Five free episodes is generous — I still went VIP." },
    ],
  },
  {
    slug: "heir-in-plain-sight",
    title: "Heir in Plain Sight",
    hook: "The florist in the window is the last name in the will.",
    synopsis:
      "Mira Quinn wraps roses and keeps her head down. Across the glass, a family crest keeps appearing where it shouldn't — in reflections, in dreams, in the lawyer who finally finds the shop. The estate has been looking for an heir. The heir has been looking for a quiet life. Neither gets what they expected.",
    genre: "hidden-identity",
    tags: ["hidden heiress", "found family", "flowers", "will"],
    rating: 4.6,
    ratingCount: 8440,
    viewCount: 980000,
    freeEpisodeCount: 3,
    isTrending: false,
    isNew: true,
    sortOrder: 9,
    episodes: [
      { title: "The Window", synopsis: "A crest in the glass." },
      { title: "The Lawyer", synopsis: "He buys a bouquet and leaves a letter." },
      { title: "Not My Name", synopsis: "Mira tries to give the fortune back." },
      { title: "The Estate", synopsis: "Rooms that remember a child she does not." },
      { title: "Cousins", synopsis: "They are kind until they are not." },
      { title: "Shop Closed", synopsis: "Someone wants her ordinary life gone." },
      { title: "The Gardener", synopsis: "He knew her mother." },
      { title: "Signature", synopsis: "The will is only the beginning." },
      { title: "Open Again", synopsis: "The shop stays. So does she." },
    ],
    reviews: [
      { name: "Amy", rating: 5, body: "Soft and sharp at once. The flower shop lighting is gorgeous." },
      { name: "Dev", rating: 4, body: "A gentler hidden-identity story that still has teeth." },
    ],
  },
  {
    slug: "penthouse-rules",
    title: "Penthouse Rules",
    hook: "House rule number one: don't fall for the woman on the sofa.",
    synopsis:
      "Tech founder Cade Ellison rents his guest suite to a stranger for one month, to prove to investors he has a 'stable household.' Journalist Wren Dalí is there to write a profile he cannot be allowed to read. The city glitter below the glass is nothing compared to the rules they keep breaking after midnight.",
    genre: "billionaire",
    tags: ["billionaire", "enemies to lovers", "fake household", "slow burn"],
    rating: 4.7,
    ratingCount: 11120,
    viewCount: 1610000,
    freeEpisodeCount: 3,
    isTrending: true,
    isNew: true,
    sortOrder: 10,
    episodes: [
      { title: "The Lease", synopsis: "One month. One sofa. Too many windows." },
      { title: "Rule One", synopsis: "He writes them on a card. She laughs." },
      { title: "Investors for Dinner", synopsis: "Wren plays the part too well." },
      { title: "The Profile", synopsis: "Her editor wants blood. She wants the truth." },
      { title: "Midnight Kitchen", synopsis: "Rules are quieter at 1 a.m." },
      { title: "A Guest", synopsis: "His ex still has the elevator code." },
      { title: "The Draft", synopsis: "He finds the article." },
      { title: "Eviction", synopsis: "Feelings do not fit in a suitcase." },
      { title: "On the Record", synopsis: "Wren publishes something else." },
      { title: "New Rules", synopsis: "The suite is no longer a guest room." },
    ],
    reviews: [
      { name: "Tasha", rating: 5, body: "City lights, wine, and a man who cannot follow his own rules. Yes." },
      { name: "Will", rating: 4, body: "Slick, adult, and very bingeable." },
    ],
  },
  {
    slug: "counterfeit-fiancee",
    title: "The Counterfeit Fiancée",
    hook: "She borrowed a ring, a name, and one gala. He noticed the ring first.",
    synopsis:
      "Con artist Jules Marin needs a seat at a charity gala to stop a real estate steal. She borrowed a ring and a rumor that she is engaged to the ungettable CEO of Graves Capital. The problem is Lucien's older brother, Nathaniel Graves, who is standing next to her when she slides the ring on — and who decides the lie will work better if he plays along.",
    genre: "ceo-romance",
    tags: ["fake engagement", "con artist", "gala", "romantic comedy-drama"],
    rating: 4.8,
    ratingCount: 12650,
    viewCount: 1870000,
    freeEpisodeCount: 4,
    isTrending: false,
    isNew: true,
    sortOrder: 11,
    episodes: [
      { title: "The Ring", synopsis: "A borrowed diamond and a very real CEO." },
      { title: "Play Along", synopsis: "Nathaniel smiles for the cameras. Jules panics." },
      { title: "Dance Card", synopsis: "The con requires closeness." },
      { title: "Her Real Job", synopsis: "She is not here for champagne." },
      { title: "The Steal", synopsis: "A deed changes hands in a coat check." },
      { title: "Caught", synopsis: "He knows. He does not tell." },
      { title: "A Real Date", synopsis: "No audience this time." },
      { title: "The Unraveling", synopsis: "The family lawyer has questions." },
      { title: "Choose the Lie", synopsis: "Or choose her." },
    ],
    reviews: [
      { name: "Gia", rating: 5, body: "Funny, glittering, and then suddenly sincere. The gala scenes are lush." },
      { name: "Peter", rating: 5, body: "I came for the con and stayed for the almost-kiss." },
    ],
  },
  {
    slug: "bloodline-confidential",
    title: "Bloodline Confidential",
    hook: "The file was marked confidential. The blood on it was not.",
    synopsis:
      "Archivist Renata Cole is hired to organize a century of family records for the wealthy Lindt estate. In a wood-paneled office, under a watching portrait, she finds a folder that should not exist: a second bloodline, a missing child, and a splash of rust the lawyers call 'an accident of storage.' Renata came for a paycheck. She stays for the truth — and because someone in the portrait's family would rather she didn't.",
    genre: "hidden-identity",
    tags: ["inheritance", "thriller", "family secrets", "archives"],
    rating: 4.7,
    ratingCount: 9050,
    viewCount: 1210000,
    freeEpisodeCount: 2,
    isTrending: false,
    isNew: false,
    sortOrder: 12,
    episodes: [
      { title: "The Portrait", synopsis: "Four faces. One of them does not belong." },
      { title: "Confidential", synopsis: "A folder with a stain." },
      { title: "The Heir", synopsis: "He is charming. He is also afraid." },
      { title: "Rain on the Glass", synopsis: "Someone follows her home." },
      { title: "A Second Will", synopsis: "The lawyers never filed it." },
      { title: "Night in the Stacks", synopsis: "The archive door locks from the outside." },
      { title: "Her Own Name", synopsis: "The missing child is not a stranger." },
      { title: "The Accident", synopsis: "Storage, they called it." },
      { title: "Open File", synopsis: "Renata copies everything." },
      { title: "The Reading", synopsis: "The family hears a new last page." },
      { title: "Clear", synopsis: "The portrait finally makes sense." },
    ],
    reviews: [
      { name: "Helen", rating: 5, body: "A inheritance thriller in short-drama form. I whispered 'one more episode' six times." },
      { name: "Andre", rating: 4, body: "Quietly scary and very elegant. The office lamp lighting is a character." },
    ],
  },
];

async function main() {
  await prisma.episodeUnlock.deleteMany();
  await prisma.watchHistory.deleteMany();
  await prisma.myListItem.deleteMany();
  await prisma.review.deleteMany();
  await prisma.order.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.episode.deleteMany();
  await prisma.series.deleteMany();
  await prisma.coinPackage.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.paymentMethod.deleteMany();
  await prisma.user.deleteMany();
  await prisma.siteSettings.deleteMany();

  const adminHash = await bcrypt.hash("LumeReel#Admin2026", 10);
  const demoHash = await bcrypt.hash("DemoUser#2026", 10);
  const vipHash = await bcrypt.hash("DemoVip#2026", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@lumereel.com",
      name: "ShortXMax Admin",
      passwordHash: adminHash,
      role: "admin",
    },
  });
  const demo = await prisma.user.create({
    data: {
      email: "demo@lumereel.com",
      name: "Demo Viewer",
      passwordHash: demoHash,
      coins: 80,
    },
  });
  const vipUser = await prisma.user.create({
    data: {
      email: "vip@lumereel.com",
      name: "Avery VIP",
      passwordHash: vipHash,
      coins: 400,
    },
  });

  const weekly = await prisma.plan.create({
    data: {
      name: "Weekly VIP",
      slug: "weekly",
      period: "weekly",
      priceCents: 499,
      perks: JSON.stringify([
        "Unlock the full catalog for 7 days",
        "No episode paywalls",
        "HD vertical playback",
        "Cancel anytime",
      ]),
      sortOrder: 1,
    },
  });
  const monthly = await prisma.plan.create({
    data: {
      name: "Monthly VIP",
      slug: "monthly",
      period: "monthly",
      priceCents: 999,
      badge: "Most popular",
      isPopular: true,
      perks: JSON.stringify([
        "Everything in Weekly",
        "Best pace for a binge month",
        "Early access to new drops",
        "Cancel anytime — keep access until the period ends",
      ]),
      sortOrder: 2,
    },
  });
  const yearly = await prisma.plan.create({
    data: {
      name: "Yearly VIP",
      slug: "yearly",
      period: "yearly",
      priceCents: 5999,
      badge: "Best value · save 50%",
      perks: JSON.stringify([
        "A full year of every episode",
        "Lowest price per month",
        "Priority on premieres",
        "Cancel anytime",
      ]),
      sortOrder: 3,
    },
  });

  await prisma.coinPackage.createMany({
    data: [
      { name: "Starter", coins: 100, bonusCoins: 0, priceCents: 199, sortOrder: 1 },
      { name: "Plus", coins: 500, bonusCoins: 50, priceCents: 999, sortOrder: 2 },
      { name: "Binge", coins: 1200, bonusCoins: 200, priceCents: 1999, sortOrder: 3 },
      { name: "Ultimate", coins: 3000, bonusCoins: 800, priceCents: 4999, sortOrder: 4 },
    ],
  });

  await prisma.paymentMethod.createMany({
    data: [
      { name: "Demo Pay", provider: "demo", description: "演示支付，立即开通", isEnabled: true, sortOrder: 1 },
      { name: "Stripe 银行卡", provider: "stripe", description: "信用卡 / 借记卡（需配置密钥）", isEnabled: true, sortOrder: 2 },
    ],
  });

  await prisma.siteSettings.create({
    data: {
      id: "default",
      siteName: "ShortXMax",
      tagline: "Short dramas that hook you in minutes.",
      seoTitle: "ShortXMax — Short dramas that hook you in minutes",
      seoDescription:
        "Stream addictive English short dramas. CEO romance, revenge, werewolf, hidden identity, and billionaire stories. Watch free episodes, then go VIP.",
      ogImage: "/og.jpg",
      demoPayEnabled: true,
      supportEmail: "support@lumereel.com",
      socialLinks: JSON.stringify({ twitter: "", instagram: "", youtube: "", tiktok: "" }),
    },
  });

  const createdShows = [];
  for (const [i, s] of shows.entries()) {
    const row = await prisma.series.create({
      data: {
        slug: s.slug,
        title: s.title,
        hook: s.hook,
        synopsis: s.synopsis,
        coverUrl: `/uploads/covers/${s.slug}.jpg`,
        backdropUrl: i === 0 ? "/uploads/og/og-hero.jpg" : `/uploads/covers/${s.slug}.jpg`,
        trailerUrl: clips[i % clips.length],
        genre: s.genre,
        tags: JSON.stringify(s.tags),
        rating: s.rating,
        ratingCount: s.ratingCount,
        viewCount: s.viewCount,
        freeEpisodeCount: s.freeEpisodeCount,
        status: "published",
        isTrending: s.isTrending,
        isNew: s.isNew,
        totalEpisodes: s.episodes.length,
        releaseYear: 2026,
        language: "English",
        seoTitle: `${s.title} — Watch free episodes on ShortXMax`,
        seoDescription: `${s.hook} ${s.synopsis}`.slice(0, 158),
        sortOrder: s.sortOrder,
        episodes: {
          create: s.episodes.map((ep, idx) => ({
            number: idx + 1,
            title: ep.title,
            synopsis: ep.synopsis,
            durationSec: 90,
            videoUrl: clips[idx % clips.length],
            thumbnailUrl: `/uploads/covers/${s.slug}.jpg`,
            isFree: idx < s.freeEpisodeCount,
            isPublished: true,
            coinPrice: 49 + (idx > 6 ? 20 : 0),
          })),
        },
        reviews: {
          create: s.reviews.map((r) => ({
            userId: r.name.startsWith("M") ? demo.id : vipUser.id,
            rating: r.rating,
            body: r.body,
            displayName: r.name,
          })),
        },
      },
      include: { episodes: true },
    });
    createdShows.push(row);
  }

  const first = createdShows[0];
  const second = createdShows[1];
  await prisma.myListItem.createMany({
    data: [
      { userId: demo.id, seriesId: first.id },
      { userId: demo.id, seriesId: createdShows[7].id },
      { userId: vipUser.id, seriesId: first.id },
    ],
  });
  await prisma.watchHistory.create({
    data: {
      userId: demo.id,
      episodeId: first.episodes[0].id,
      progressSec: 4,
      completed: false,
    },
  });
  await prisma.watchHistory.create({
    data: {
      userId: demo.id,
      episodeId: second.episodes[0].id,
      progressSec: 8,
      completed: true,
    },
  });

  const ends = new Date();
  ends.setFullYear(ends.getFullYear() + 1);
  await prisma.subscription.create({
    data: {
      userId: vipUser.id,
      planId: yearly.id,
      status: "active",
      startsAt: new Date(),
      endsAt: ends,
      provider: "demo",
    },
  });

  const paidAt = new Date();
  await prisma.order.createMany({
    data: [
      {
        userId: vipUser.id,
        type: "subscription",
        amountCents: yearly.priceCents,
        status: "paid",
        provider: "demo",
        planId: yearly.id,
        paidAt,
        providerRef: "seed_year",
      },
      {
        userId: demo.id,
        type: "coins",
        amountCents: 199,
        status: "paid",
        provider: "demo",
        paidAt,
        providerRef: "seed_coins",
      },
    ],
  });

  console.log("Seeded ShortXMax:", {
    shows: createdShows.length,
    admin: admin.email,
    demo: demo.email,
    vip: vipUser.email,
    plans: [weekly.slug, monthly.slug, yearly.slug],
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
