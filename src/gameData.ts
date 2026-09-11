// Game Data - Characters, Enemies, Dialogues

export interface Character {
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  sprite: string;
  color: string;
  description: string;
  acts: string[];
  actResponses: string[];
}

export interface Enemy {
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  sprite: string;
  color: string;
  dialogue: string[];
  acts: string[];
  actResponses: string[];
  spareable: boolean;
  spareThreshold: number;
  mercyCount: number;
  attackPatterns: AttackPattern[];
  defeatText: string;
  spareText: string;
}

export interface AttackPattern {
  bullets: Bullet[];
  duration: number;
  speed: number;
  name: string;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  shape: 'circle' | 'square' | 'diamond';
}

export interface Room {
  id: string;
  name: string;
  description: string;
  exits: { direction: string; roomId: string; label: string }[];
  encounters?: string[];
  npcs?: NPC[];
  items?: GameItem[];
  bg: string;
}

export interface NPC {
  name: string;
  sprite: string;
  dialogue: string[];
  color: string;
}

export interface GameItem {
  name: string;
  description: string;
  healAmount: number;
  emoji: string;
}

export const BERT: Character = {
  name: "Bert",
  hp: 92,
  maxHp: 92,
  atk: 12,
  def: 8,
  sprite: "🧑‍🎓",
  color: "#4488ff",
  description: "A student at the Church Gymnasium. Determined and kind-hearted.",
  acts: ["Encourage", "Study Hard", "Pray", "Joke"],
  actResponses: [
    "Bert gives a motivational speech! ATK and DEF up!",
    "Bert opens his textbook! The enemy is confused by knowledge!",
    "Bert says a quiet prayer! A warm feeling fills the room!",
    "Bert tells a terrible joke! The enemy can't stop laughing!",
  ],
};

export const PARTY_MEMBERS: Character[] = [
  {
    name: "Martin",
    hp: 80,
    maxHp: 80,
    atk: 14,
    def: 6,
    sprite: "👦",
    color: "#ff6644",
    description: "The class clown. Attacks with dad jokes.",
    acts: ["Tell Joke", "Distract", "High Five"],
    actResponses: [
      "Martin tells a joke so bad it hurts! Enemy takes emotional damage!",
      "Martin waves his arms around! The enemy is confused!",
      "Martin gives a high five! Morale boost!",
    ],
  },
  {
    name: "Kája",
    hp: 75,
    maxHp: 75,
    atk: 10,
    def: 12,
    sprite: "👧",
    color: "#ff44aa",
    description: "The smartest girl in class. Fights with logic.",
    acts: ["Explain", "Correct Grammar", "Share Notes"],
    actResponses: [
      "Kája explains the situation perfectly! The enemy has an existential crisis!",
      "Kája corrects the enemy's grammar! They're too embarrassed to attack!",
      "Kája shares her perfectly organized notes! The enemy is impressed!",
    ],
  },
];

export const ENEMIES: Record<string, Enemy> = {
  homework: {
    name: "Evil Homework",
    hp: 60,
    maxHp: 60,
    atk: 8,
    def: 4,
    sprite: "📝",
    color: "#ffaa00",
    dialogue: [
      "* Evil Homework blocks your path!",
      "* It's due tomorrow and you haven't started!",
      "* Evil Homework rustles menacingly!",
    ],
    acts: ["Do It", "Procrastinate", "Cheat"],
    actResponses: [
      "You actually do the homework! Evil Homework feels fulfilled and dissolves!",
      "You decide to do it later! Evil Homework grows stronger from your guilt!",
      "You try to copy from Matěj! Evil Homework is offended by the bad handwriting!",
    ],
    spareable: true,
    spareThreshold: 3,
    mercyCount: 0,
    attackPatterns: [
      {
        name: "Paper Storm",
        bullets: Array.from({ length: 8 }, (_, i) => ({
          x: Math.random() * 300,
          y: -20,
          vx: (Math.random() - 0.5) * 2,
          vy: 2 + Math.random() * 2,
          size: 8,
          color: "#ffaa00",
          shape: 'square' as const,
        })),
        duration: 4000,
        speed: 1,
      },
      {
        name: "Deadline Rush",
        bullets: Array.from({ length: 12 }, (_, i) => ({
          x: 150 + Math.cos(i * Math.PI / 6) * 150,
          y: 100 + Math.sin(i * Math.PI / 6) * 100,
          vx: -Math.cos(i * Math.PI / 6) * 3,
          vy: -Math.sin(i * Math.PI / 6) * 3,
          size: 6,
          color: "#ff4400",
          shape: 'diamond' as const,
        })),
        duration: 3000,
        speed: 1.5,
      },
    ],
    defeatText: "* Evil Homework crumbles into pieces. You're free... for now.",
    spareText: "* Evil Homework was completed peacefully. It thanks you with a grade A.",
  },
  popQuiz: {
    name: "Pop Quiz Monster",
    hp: 80,
    maxHp: 80,
    atk: 10,
    def: 6,
    sprite: "❓",
    color: "#aa44ff",
    dialogue: [
      "* Pop Quiz Monster appears unexpectedly!",
      "* It wasn't on the study schedule!",
      "* Pop Quiz Monster asks: 'What is 7x8?'",
    ],
    acts: ["Answer", "Panic", "Ask Neighbor"],
    actResponses: [
      "You answer correctly! Pop Quiz Monster is impressed and calms down!",
      "You panic loudly! Pop Quiz Monster feeds on your fear!",
      "You try to peek at Dan's paper! He covers it. Pop Quiz Monster laughs!",
    ],
    spareable: true,
    spareThreshold: 3,
    mercyCount: 0,
    attackPatterns: [
      {
        name: "Question Barrage",
        bullets: Array.from({ length: 10 }, (_, i) => ({
          x: Math.random() * 300,
          y: -20 - i * 30,
          vx: (Math.random() - 0.5) * 3,
          vy: 3 + Math.random(),
          size: 10,
          color: "#aa44ff",
          shape: 'diamond' as const,
        })),
        duration: 4000,
        speed: 1.2,
      },
      {
        name: "Multiple Choice Hell",
        bullets: Array.from({ length: 16 }, (_, i) => ({
          x: i % 2 === 0 ? -10 : 310,
          y: 20 + (i / 2) * 30,
          vx: i % 2 === 0 ? 3 : -3,
          vy: (Math.random() - 0.5) * 2,
          size: 8,
          color: "#ff44aa",
          shape: 'circle' as const,
        })),
        duration: 4500,
        speed: 1,
      },
    ],
    defeatText: "* Pop Quiz Monster fades away. The answers were all 'C' anyway.",
    spareText: "* Pop Quiz Monster is satisfied with your knowledge. It gives you extra credit.",
  },
  cafeteria: {
    name: "Cafeteria Food Golem",
    hp: 100,
    maxHp: 100,
    atk: 12,
    def: 8,
    sprite: "🍲",
    color: "#88aa44",
    dialogue: [
      "* Cafeteria Food Golem blocks the hallway!",
      "* It smells... questionable.",
      "* 'TODAY'S SPECIAL: Mystery Stew!' it announces.",
    ],
    acts: ["Compliment", "Refuse", "Eat It"],
    actResponses: [
      "You compliment the Food Golem! It blushes (somehow) and lets you pass!",
      "You refuse to eat! The Food Golem is offended and attacks!",
      "You eat it... it's actually not bad? The Food Golem is touched!",
    ],
    spareable: true,
    spareThreshold: 2,
    mercyCount: 0,
    attackPatterns: [
      {
        name: "Mystery Splash",
        bullets: Array.from({ length: 12 }, (_, i) => ({
          x: 150,
          y: 100,
          vx: Math.cos(i * Math.PI / 6) * 4,
          vy: Math.sin(i * Math.PI / 6) * 4,
          size: 10,
          color: "#88aa44",
          shape: 'circle' as const,
        })),
        duration: 3500,
        speed: 1,
      },
      {
        name: "Food Rain",
        bullets: Array.from({ length: 15 }, (_, i) => ({
          x: Math.random() * 300,
          y: -20 - Math.random() * 100,
          vx: (Math.random() - 0.5) * 2,
          vy: 4 + Math.random() * 2,
          size: 8,
          color: "#aacc44",
          shape: 'square' as const,
        })),
        duration: 4000,
        speed: 1.3,
      },
    ],
    defeatText: "* Cafeteria Food Golem collapses. The mystery stew was its life force.",
    spareText: "* Cafeteria Food Golem is happy someone finally appreciated its cooking!",
  },
  principal: {
    name: "The Principal",
    hp: 200,
    maxHp: 200,
    atk: 16,
    def: 12,
    sprite: "👔",
    color: "#ff2222",
    dialogue: [
      "* THE PRINCIPAL APPEARS!",
      "* 'Students! Why are you not in class!?'",
      "* The Principal's authority fills the room!",
      "* 'Detention! For ALL of you!'",
    ],
    acts: ["Apologize", "Explain", "Challenge Authority"],
    actResponses: [
      "You apologize sincerely! The Principal softens... slightly!",
      "You explain your quest! The Principal is intrigued but still angry!",
      "You challenge the Principal's authority! They're FURIOUS! But also impressed!",
    ],
    spareable: true,
    spareThreshold: 5,
    mercyCount: 0,
    attackPatterns: [
      {
        name: "Detention Slip Storm",
        bullets: Array.from({ length: 20 }, (_, i) => ({
          x: Math.random() * 300,
          y: -20 - i * 20,
          vx: (Math.random() - 0.5) * 4,
          vy: 3 + Math.random() * 3,
          size: 8,
          color: "#ff2222",
          shape: 'square' as const,
        })),
        duration: 5000,
        speed: 1.5,
      },
      {
        name: "Authoritarian Spiral",
        bullets: Array.from({ length: 24 }, (_, i) => ({
          x: 150 + Math.cos(i * Math.PI / 12) * 120,
          y: 100 + Math.sin(i * Math.PI / 12) * 80,
          vx: -Math.cos(i * Math.PI / 12) * 3,
          vy: -Math.sin(i * Math.PI / 12) * 3,
          size: 6,
          color: "#ff4444",
          shape: 'diamond' as const,
        })),
        duration: 5000,
        speed: 1.2,
      },
      {
        name: "Final Warning",
        bullets: Array.from({ length: 30 }, (_, i) => ({
          x: i % 2 === 0 ? -10 : 310,
          y: Math.random() * 200,
          vx: i % 2 === 0 ? 5 : -5,
          vy: (Math.random() - 0.5) * 3,
          size: 7,
          color: "#ff0000",
          shape: 'circle' as const,
        })),
        duration: 6000,
        speed: 2,
      },
    ],
    defeatText: "* The Principal falls to their knees... 'I just wanted... order...' *",
    spareText: "* The Principal calms down. 'Perhaps... I was too harsh. Go, students. Learn well.'",
  },
  matěj: {
    name: "Matěj (Corrupted)",
    hp: 120,
    maxHp: 120,
    atk: 13,
    def: 9,
    sprite: "😈",
    color: "#8800ff",
    dialogue: [
      "* MATĚJ APPEARS! But something is wrong...",
      "* His eyes glow with dark energy!",
      "* 'Hehehe... Bert... you can't stop me!'",
      "* 'The Dark World has given me POWER!'",
    ],
    acts: ["Remind of Friendship", "Challenge to Game", "Call Him Bro"],
    actResponses: [
      "You remind Matěj of your friendship! The corruption flickers!",
      "You challenge Matěj to a game! He can't resist! The corruption weakens!",
      "You call him 'bro'! Matěj's eye twitches! Memories flood back!",
    ],
    spareable: true,
    spareThreshold: 4,
    mercyCount: 0,
    attackPatterns: [
      {
        name: "Dark Energy Blast",
        bullets: Array.from({ length: 16 }, (_, i) => ({
          x: 150,
          y: 100,
          vx: Math.cos(i * Math.PI / 8) * 5,
          vy: Math.sin(i * Math.PI / 8) * 5,
          size: 8,
          color: "#8800ff",
          shape: 'diamond' as const,
        })),
        duration: 4000,
        speed: 1.5,
      },
      {
        name: "Corruption Spiral",
        bullets: Array.from({ length: 20 }, (_, i) => ({
          x: 150 + Math.cos(i * 0.5) * (i * 8),
          y: 100 + Math.sin(i * 0.5) * (i * 6),
          vx: Math.cos(i * 0.5) * 2,
          vy: Math.sin(i * 0.5) * 2,
          size: 6,
          color: "#aa44ff",
          shape: 'circle' as const,
        })),
        duration: 5000,
        speed: 1.3,
      },
    ],
    defeatText: "* Matěj falls... 'Bert... I'm sorry... the darkness... it controlled me...'",
    spareText: "* The corruption leaves Matěj's body! 'Bert! You saved me! Thanks, bro!'",
  },
};

export const ROOMS: Record<string, Room> = {
  classroom: {
    id: "classroom",
    name: "Classroom",
    description: "Your classroom at the Church Gymnasium. Desks are arranged in rows. The chalkboard reads 'Today: Salvation & Algebra'.",
    exits: [
      { direction: "east", roomId: "hallway", label: "Go to hallway →" },
    ],
    npcs: [
      {
        name: "Šíma",
        sprite: "🧒",
        dialogue: [
          "* Šíma: 'Hey Bert! Have you seen the weird glow coming from the supply closet?'",
          "* Šíma: 'I tried to open it but... the door just... wasn't there anymore.'",
          "* Šíma: 'Something is definitely wrong in this school today.'",
        ],
        color: "#44dd88",
      },
    ],
    items: [{ name: "School Lunch", description: "Mystery meat sandwich", healAmount: 20, emoji: "🥪" }],
    bg: "#1a1a2e",
  },
  hallway: {
    id: "hallway",
    name: "Dark Hallway",
    description: "The hallway is darker than usual. Strange symbols glow on the walls. The lockers hum with energy.",
    exits: [
      { direction: "west", roomId: "classroom", label: "← Back to classroom" },
      { direction: "north", roomId: "cafeteria", label: "Go to cafeteria ↑" },
      { direction: "east", roomId: "library", label: "Go to library →" },
    ],
    encounters: ["homework"],
    npcs: [
      {
        name: "Dan",
        sprite: "👦",
        dialogue: [
          "* Dan: 'Dude, this hallway is WILD right now.'",
          "* Dan: 'I think we might be in another dimension or something.'",
          "* Dan: 'At least the WiFi still works though.'",
        ],
        color: "#ffaa44",
      },
    ],
    bg: "#16213e",
  },
  cafeteria: {
    id: "cafeteria",
    name: "Cafeteria of Doom",
    description: "The cafeteria tables float in mid-air. The food counter glows with an eerie light. Something lurks behind the salad bar.",
    exits: [
      { direction: "south", roomId: "hallway", label: "↓ Back to hallway" },
      { direction: "east", roomId: "darkroom", label: "Enter the Dark Door →" },
    ],
    encounters: ["cafeteria"],
    npcs: [
      {
        name: "Matěj",
        sprite: "👦",
        dialogue: [
          "* Matěj: 'Bert! Thank god you're here!'",
          "* Matěj: 'Something came through the closet door...'",
          "* Matěj: 'It's heading to the principal's office!'",
          "* Matěj: 'We need to stop it before it corrupts the whole school!'",
        ],
        color: "#ff8844",
      },
    ],
    items: [{ name: "Energy Drink", description: "Suspiciously glowing", healAmount: 35, emoji: "🥤" }],
    bg: "#0f3460",
  },
  library: {
    id: "library",
    name: "Forbidden Library",
    description: "Books fly around on their own. The Dewey Decimal System has become sentient and hostile.",
    exits: [
      { direction: "west", roomId: "hallway", label: "← Back to hallway" },
    ],
    encounters: ["popQuiz"],
    npcs: [
      {
        name: "Kája",
        sprite: "👧",
        dialogue: [
          "* Kája: 'Bert! I've been researching!'",
          "* Kája: 'According to this ancient textbook (it's just our history book but it's GLOWING)...'",
          "* Kája: 'The Dark World feeds on unresolved school stress!'",
          "* Kája: 'We need to confront the source in the principal's office!'",
        ],
        color: "#ff44aa",
      },
    ],
    items: [{ name: "Knowledge Apple", description: "An apple a day...", healAmount: 30, emoji: "🍎" }],
    bg: "#1a1a3e",
  },
  darkroom: {
    id: "darkroom",
    name: "The Dark Office",
    description: "The principal's office has been transformed. Dark energy swirls around the desk. The Principal sits on their throne of detention slips.",
    exits: [
      { direction: "west", roomId: "cafeteria", label: "← Retreat to cafeteria" },
    ],
    encounters: ["principal"],
    npcs: [
      {
        name: "Martin",
        sprite: "👦",
        dialogue: [
          "* Martin: 'This is it, Bert! The final showdown!'",
          "* Martin: 'I've been practicing my jokes for this moment!'",
          "* Martin: '...Wait, that's not helpful, is it?'",
          "* Martin: 'Just... be careful, okay? You're our best shot.'",
        ],
        color: "#ff6644",
      },
    ],
    bg: "#0a0a1e",
  },
};

export const STORY_INTRO = [
  "* It's a normal day at the Church Gymnasium of the Teutonic Order.",
  "* You are BERT, a student just trying to survive another school day.",
  "* But today... something feels different.",
  "* The shadows seem deeper. The walls whisper.",
  "* Your phone buzzes. A message from Šíma:",
  "* 'BERT the supply closet is GLOWING come quick!!!'",
  "* You rush to school... and everything changes.",
  "* The Dark World has appeared... INSIDE your school!",
  "* Your friends are scattered throughout the darkened halls.",
  "* You must find them, fight through the darkness,",
  "* and save your school from eternal detention!",
  "",
  "* Press ENTER or click to begin your adventure!",
];

export const STORY_MIDPOINTS: Record<string, string[]> = {
  hallway: [
    "* As you enter the hallway, reality shifts around you.",
    "* The lockers are now portals to other classrooms...",
    "* that never existed. Math class, but the numbers fight back.",
    "* Martin and Kája appear beside you!",
    "* Martin: 'Dude, this is either awesome or terrifying.'",
    "* Kája: 'Statistically? Both.'",
    "* Your party has formed! Fight together!",
  ],
  cafeteria: [
    "* The cafeteria has become a battlefield of floating food.",
    "* Matěj is here, but he seems... different.",
    "* Dark energy crackles around him.",
    "* Matěj: 'Bert... I can feel it... the power...'",
    "* Kája: 'Matěj! Snap out of it!'",
    "* Matěj: 'I... I can't... it's so tempting...'",
    "* You must save Matěj from the corruption!",
  ],
  darkroom: [
    "* This is it. The heart of the Dark World.",
    "* The Principal has been consumed by the darkness of",
    "* a thousand unfiled paperwork and endless parent meetings.",
    "* Principal: 'STUDENTS! You think you can just WALK around",
    "* my school during CLASS HOURS?!'",
    "* The Principal's eyes glow red!",
    "* This is the FINAL BATTLE!",
    "* For your school! For your friends! For your GPA!",
  ],
};
