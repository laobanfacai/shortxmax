export type Editorial = {
  slug: string;
  title: string;
  description: string;
  dek: string;
  genre: string;
  body: { heading: string; text: string }[];
};

export const editorials: Editorial[] = [
  {
    slug: "best-billionaire-short-dramas",
    title: "Best billionaire short dramas on ShortXMax",
    description:
      "A guide to the best billionaire and CEO romance short dramas streaming on ShortXMax — contract marriages, penthouse rules, and vows with a price tag.",
    dek: "If you came for the penthouse, the contract, and the man who does not do discounts, start here.",
    genre: "billionaire",
    body: [
      {
        heading: "Why this trope hits in under two minutes",
        text: "Billionaire short dramas work because the power imbalance is visible in the first shot: a glass terrace, a signed contract, a public appearance that is supposed to be fake. ShortXMax's originals lean into that hook, then flip it — the woman in the room is rarely as powerless as the first episode pretends.",
      },
      {
        heading: "Where to start",
        text: "The Velvet Contract is the purest CEO romance in the catalog: a year-long marriage on paper, a board that wants her gone, and a kiss that was only meant for the cameras. The Billion-Dollar Vow and Penthouse Rules go harder on wealth and control, while The Counterfeit Fiancée plays the same world with a sharper, almost playful con.",
      },
      {
        heading: "How to watch",
        text: "Each of these series opens with free episodes. If you know you will finish tonight, a monthly or yearly VIP plan is the better value. If you only want one cliffhanger, use coins to unlock a single episode.",
      },
    ],
  },
  {
    slug: "best-werewolf-short-dramas",
    title: "Best werewolf short dramas on ShortXMax",
    description:
      "The best werewolf and rejected-mate short dramas on ShortXMax, including Moonlit Claim and The Alpha's Rejected Mate.",
    dek: "Moonlight, a bond he swore he didn't want, and the walk-away that never really holds.",
    genre: "werewolf",
    body: [
      {
        heading: "The claim, the rejection, the return",
        text: "Werewolf short dramas thrive on a single emotional engine: recognition. Someone looks at you and the world tilts. ShortXMax's Moonlit Claim starts with that pull in a misted forest; The Alpha's Rejected Mate starts with the wound of being turned away — and the slow, dangerous walk back.",
      },
      {
        heading: "What to expect",
        text: "These are romantic supernatural shorts, not horror anthologies. Expect pack politics, jealous rivals, and nights that last longer than they should. The first episodes are free so you can feel the bond before you pay for the rest of the moon cycle.",
      },
      {
        heading: "After you finish",
        text: "If you like hidden power more than fangs, jump to hidden-identity titles such as She Was Never the Maid and Heir in Plain Sight — different mythology, same 'you have no idea who I am' charge.",
      },
    ],
  },
  {
    slug: "best-revenge-short-dramas",
    title: "Best revenge short dramas on ShortXMax",
    description:
      "A viewer guide to ShortXMax's sharpest revenge short dramas, from The Last Laugh to Ashes of Her Name and Bloodline Confidential.",
    dek: "They took everything. She came back in silk — or in the rain, holding a file they never wanted opened.",
    genre: "revenge",
    body: [
      {
        heading: "Revenge, served in ten-minute pours",
        text: "A good revenge short drama does not wait for episode seven to land the injustice. The Last Laugh opens on the aftermath and lets you walk away from the fire with her. Ashes of Her Name is colder and more ruined; Bloodline Confidential turns the same hunger toward inheritance papers and a family portrait that lies.",
      },
      {
        heading: "The pleasure of the turn",
        text: "These stories work because the first free episodes establish the wound, then the paywalled run is all about the turn: the public ruin, the stolen name, the moment the board realizes who she is. VIP is built for that binge.",
      },
      {
        heading: "If you want the softer edge",
        text: "Some revenge plots sit inside romance — contract marriages and hidden heiresses included. Browse the revenge genre page, then follow related titles from each show page.",
      },
    ],
  },
];

export function getEditorial(slug: string) {
  return editorials.find((e) => e.slug === slug);
}
