// ─────────────────────────────────────────────────────────────────────────────
//  PORTFOLIO CONTENT — edit this file to make the studio yours.
//  Every panel that opens in the room is defined here. Section types:
//    text, list, tags, links, stats, timeline, contrib (github grid), github-stats,
//    clock, music, image, video, gallery (photos / phone screens / short videos), quotes
//  Media lives in assets/media/. Content migrated from the main portfolio site.
// ─────────────────────────────────────────────────────────────────────────────
window.CONTENT = {
  profile: {
    name: 'Dev Chaudhary',
    role: 'Product Designer · UI/UX',
    greeting: "Hey, I'm Dev! Nice to meet you. Look around my studio.",
  },

  about: {
    title: 'About Me', icon: '◆',
    subtitle: 'Product designer with a taste of tech, aesthetics & product thinking',
    sections: [
      { type: 'image', src: 'assets/media/dev-1.webp', alt: 'Dev giving a thumbs up' },
      { type: 'text', body: "Hi, I'm Dev, a self-taught product designer who found design through frontend development in the 2nd year of college." },
      { type: 'text', title: 'A moment of curiosity', body: 'I was doing frontend development when suddenly a few questions struck me: "How are these interfaces made?" "Is there any way to do this?" That\'s when I researched it and came to know about UI/UX design. From 2nd year till now, my journey has been full of learning, gaining exposure to AI methodologies in the field, developing interfaces and so on. Tbh, it\'s very fun!' },
      { type: 'list', title: 'The loop I live by', items: [
        '🛠  BUILD — interfaces, prototypes and, these days, the front-end too.',
        '📖  LEARN — self-taught, always exploring AI-assisted workflows.',
        '👟  RUN — longest run so far is 15 km. 21 km counting soon.',
        '🔁  REPEAT — still learning and exploring, every day.',
      ] },
      { type: 'tags', title: 'Also', items: ['2× design hackathon winner 🏆', 'Talks about Figma', 'Motion design', 'Micro-interactions', 'Design systems'] },
      { type: 'text', body: 'Tip: walk up to things and press E (or just click them). Try petting the cat.' },
    ],
  },

  contact: {
    title: "Let's Talk", icon: '✉',
    subtitle: 'Have a project in mind? Say hello.',
    sections: [
      { type: 'text', body: "Let's design something thoughtful together. The fastest way to reach me is LinkedIn." },
      { type: 'links', items: [
        { label: 'LinkedIn', href: 'https://www.linkedin.com/in/dev-chaudhary-7983a822a', note: 'Dev Chaudhary' },
        { label: 'Instagram', href: 'https://www.instagram.com/iamdc5203/', note: '@iamdc5203' },
        { label: 'Dribbble', href: 'https://dribbble.com/DevChaudhary523', note: 'DevChaudhary523' },
        { label: 'GitHub', href: 'https://github.com/DEV1033', note: '@DEV1033' },
      ] },
    ],
  },

  trustyy: {
    title: 'Trustyy', icon: '🛡',
    subtitle: 'Shopify app revamp · UI/UX Designer · 1 month',
    sections: [
      { type: 'video', src: 'assets/media/trustyy.mp4' },
      { type: 'text', body: "A revamp that reached 497 merchants in July. I redesigned Trustyy Reviews from the user's point of view. Not just a UI makeover: I spent a month rethinking the experience, simplifying flows and removing friction." },
      { type: 'stats', items: [
        { value: '497', label: 'merchants (from 390)' },
        { value: '260', label: 'installs in July' },
        { value: '+22%', label: 'merchant growth' },
      ] },
      { type: 'text', title: 'Biggest takeaway', body: "Good UX isn't about adding more. It's about making the right things easier. From messy flows to clearer experiences." },
      { type: 'tags', items: ['Shopify App', 'UI/UX Design'] },
    ],
  },

  gooddex: {
    title: 'Goodex', icon: '●',
    subtitle: 'AI-powered candidate search · Goodspace AI',
    sections: [
      { type: 'video', src: 'assets/media/goodex.mp4', poster: 'assets/media/goodex-poster.webp' },
      { type: 'text', body: 'Helping recruiters discover the right talent, faster. Find the right talent in one sentence.' },
      { type: 'list', title: 'How it works', items: [
        'Natural-language search: just describe who you need.',
        'Filters auto-detected: role, experience, location, skills.',
        'Review & tweak the filters before you search.',
        'Rich, scannable candidate cards to unlock & save top talent.',
      ] },
      { type: 'tags', items: ['Internal Tool', 'Early Stage Startup', '0 → 1'] },
    ],
  },

  skills: {
    title: 'Skills & Tools', icon: '📚',
    subtitle: 'Skilled in the tools that matter',
    sections: [
      { type: 'tags', title: 'Practice', items: ['Prototyping', 'AI Assisted Workflow', 'User Research', 'Design Thinking', 'Product Thinking'] },
      { type: 'tags', title: 'Tools', items: ['Figma', 'Claude', 'Gemini', 'LottieFiles', 'Framer', 'VS Code', 'GitHub'] },
      { type: 'list', title: 'Favourites', items: [
        'Figma — intermediate-level UI/UX design, prototyping, auto-layout, component libraries and design systems.',
        'Claude — designed and built my website from scratch using Claude chat and design, from design system to deployment.',
      ] },
    ],
  },

  ideas: {
    title: 'Kind Words', icon: '💬',
    subtitle: 'What teammates say',
    sections: [
      { type: 'quotes', items: [
        { text: 'We gave Dev a messy mix of ideas, screenshots, references, and “can we try this?” moments… and somehow, he turned it all into a UI we absolutely love.\n\nHe designed the entire app and website, kept everything consistent, and paid attention to details we didn’t even think about. The best part? He didn’t just make it look pretty; he made it make sense.\n\nHonestly, one of those decisions where you finish the project and think, “Yep, we picked the right person”.\n\nWorth it, having a UI/UX designer who can read our minds and bring exactly what we imagined to life.', name: 'Falguni Dangi', org: 'Partnership Manager at Easy Subscriptions Shopify App' },
        { text: 'Working with Dev has been a game-changer for our product. Their eye for detail, user-first mindset, and ability to turn complex ideas into clean, intuitive designs greatly improved our user experience.', name: 'Arvind Tiwari', org: 'NetApp' },
        { text: 'Dev is a highly reliable and creative teammate. He brings strong UI/UX expertise to the table and always ensures that designs are not only visually appealing but also user-friendly.', name: 'Ashutosh Patel', org: 'NuageBiz Tech' },
        { text: 'Dev is a pleasure to work with. While working with us he showed the ability to think outside the box and handle unforeseen challenges with creative solutions. He helped us bring our ideas to reality.', name: 'Santosh Yadav', org: 'Anubit Solutions' },
      ] },
    ],
  },

  music: {
    title: 'Now Playing', icon: '♪',
    subtitle: 'What keeps me in flow',
    sections: [
      // live from Spotify (scrobbled to Last.fm) via /api/now-playing: playing now, else the last song played
      { type: 'spotify', title: "On Dev's Spotify" },
      { type: 'music', title: 'Studio radio' },
      { type: 'text', body: 'A little lo-fi loop for the studio. Every note is generated in code.' },
    ],
  },

  github: {
    username: 'DEV1033', // the room's GitHub board and this panel show this account's real activity
    title: 'GitHub', icon: '⌥',
    subtitle: 'Owning the front-end too',
    sections: [
      // live data: contributions from github-contributions-api.jogruber.de, repos/followers from api.github.com
      { type: 'github-stats' },
      { type: 'contrib' },
      { type: 'links', items: [{ label: 'View my GitHub', href: 'https://github.com/DEV1033', note: '@DEV1033' }] },
    ],
  },

  experience: {
    title: 'Experience', icon: '⌘',
    subtitle: 'My design journey so far',
    sections: [
      { type: 'timeline', items: [
        { when: 'Apr 2026 — Now', what: 'UI/UX Designer · Easycomm Innovations' },
        { when: 'Jan 2026 — Mar 2026', what: 'Product Designer · Goodspace AI', note: 'Designed Goodex, an AI-powered candidate search (0 → 1).' },
        { when: 'Oct 2025 — Nov 2025', what: 'Freelance Designer · Stealth' },
        { when: 'Oct 2024 — Sept 2025', what: 'UI/UX Design Intern · GeeksforGeeks' },
      ] },
      { type: 'links', items: [{ label: 'Full resume (PDF)', href: 'resume.pdf', note: 'DevChaudhary2026.pdf' }] },
    ],
  },

  running: {
    title: 'Run Log', icon: '👟',
    subtitle: 'I like to run as well',
    sections: [
      { type: 'stats', items: [
        { value: '15 km', label: 'longest run' },
        { value: '31:53', label: '5 km · 6:22/km' },
        { value: '16:13', label: '3 km · ISA Marathon' },
      ] },
      { type: 'gallery', items: [
        { src: 'assets/media/marathon.webp', alt: 'Dev at the ISA Marathon 2026', caption: 'ISA Marathon 2026 · finished strongly' },
        { src: 'assets/media/run-5k.webp', alt: 'Strava screenshot of a 5 km run', caption: '5 km run · it was a nice feeling' },
      ] },
      { type: 'text', body: 'My highest distance is 15 km. 21 km counting soon!' },
    ],
  },

  resume: {
    title: 'Resume', icon: '▤',
    subtitle: 'The one-page version',
    sections: [
      { type: 'text', body: 'Aspiring Product Designer with a taste of Tech, Aesthetics & Product Thinking. Currently @ Easycomm.io, previously @ Goodspace.ai and GeeksforGeeks.' },
      { type: 'links', items: [{ label: 'Open resume (PDF)', href: 'resume.pdf', note: 'DevChaudhary2026.pdf' }] },
    ],
  },

  location: {
    title: 'Where I Am', icon: '🌍',
    subtitle: 'Based in India',
    sections: [
      { type: 'clock', tz: 'Asia/Kolkata', label: 'My local time' },
    ],
  },

  reading: {
    title: 'Design Shelf', icon: '🎨',
    subtitle: 'Featured designs & motion experiments',
    sections: [
      { type: 'gallery', title: 'Some featured design', tall: true, items: [
        { src: 'assets/media/screen-1.webp', alt: 'VyanEx landing screen' },
        { src: 'assets/media/screen-5.webp', alt: 'Check-in timeline screen (light)' },
        { src: 'assets/media/screen-6.webp', alt: 'Check-in timeline screen (dark)' },
        { src: 'assets/media/screen-2.webp', alt: 'VyanEx patient records screen' },
        { src: 'assets/media/screen-7.webp', alt: 'Check-in screen' },
        { src: 'assets/media/screen-3.webp', alt: 'VyanEx team management screen' },
        { src: 'assets/media/screen-4.webp', alt: 'VyanEx dashboard screen' },
      ] },
      { type: 'gallery', title: 'Some motion experiments', items: [
        { src: 'assets/media/motion-1.mp4' },
        { src: 'assets/media/motion-2.mp4' },
        { src: 'assets/media/motion-3.mp4' },
        { src: 'assets/media/motion-4.mp4' },
        { src: 'assets/media/motion-5.mp4' },
      ] },
    ],
  },
};
