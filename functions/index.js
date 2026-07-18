/**
 * Support Pool — Caption Generator Firebase Function
 *
 * Uses the same static data as tiktapdown-mcp (MIT) for
 * get_tiktok_hashtags and generate_tiktok_hook, so there are
 * no external API calls and no per-use cost.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: "asia-southeast1", maxInstances: 10 });

// ─── Static data from tiktapdown-mcp (MIT) ───────────────────────────────────

const NICHES = {
  fitness: {
    label: "Fitness",
    hashtags: ["fitnessmotivation","workout","gymtok","fittok","homeworkout","weightloss","musclebuilding","cardio","fitnessgirl","fitnessjourney","healthylifestyle","workoutmotivation","gym","bodybuilding","personaltrainer"],
    tips: [
      "Goal tags (#weightloss, #musclebuilding) outperform method tags (#cardio) — they reach viewers with intent.",
      "Commit to either #gymtok OR #homeworkout, not both. Mixed signals confuse the algorithm.",
      "Use #fitnessmotivation only for emotional peak moments — not routine content.",
    ],
  },
  beauty: {
    label: "Beauty",
    hashtags: ["beautytok","makeuptutorial","skincare","grwm","makeupartist","skincareroutine","glassskin","cleanbeauty","beautyreview","drugstoremakeup","makeuptransformation","skintok","beautyover40","naturalmakeup","makeuptips"],
    tips: [
      "#grwm (Get Ready With Me) is the highest-retention beauty format — use it as your anchor.",
      "Pair transformation tags (#makeuptransformation) with routine tags for algorithm breadth.",
      "#skintok has a highly engaged micro-community — great for skincare-specific content.",
    ],
  },
  food: {
    label: "Food",
    hashtags: ["foodtok","recipe","cooking","foodie","easyrecipe","mealprep","whatieatinaday","tasty","homecooking","foodlovers","quickrecipes","healthyfood","asmrfood","mukbang","dinnerideas"],
    tips: [
      "#easyrecipe and #quickrecipes filter for high-intent viewers who actually cook.",
      "ASMR food content paired with #asmrfood drives 3x longer watch time.",
      "#whatieatinaday is a strong lifestyle/food crossover tag for account growth.",
    ],
  },
  travel: {
    label: "Travel",
    hashtags: ["traveltok","travel","wanderlust","travelgram","travelreels","budgettravel","solotravel","travelcouple","hiddengems","travellife","adventure","digitalnomad","backpacker","traveladvice","travelinspiration"],
    tips: [
      "#hiddengems earns saves — saved content signals high value to the algorithm.",
      "#budgettravel and #solotravel attract highly engaged niche communities.",
      "Destination-specific hashtags outperform generic #travel for SEO discovery.",
    ],
  },
  tech: {
    label: "Tech",
    hashtags: ["techtok","technology","techreview","gadgets","apple","android","coding","programming","techlifestyle","aitools","chatgpt","techhacks","softwareengineer","techsetup","productivitytools"],
    tips: [
      "#aitools is the fastest-growing tech tag — huge early-mover opportunity.",
      "#techsetup drives aspirational saves — people save setup content for reference.",
      "Pair #coding with language-specific tags (#python, #javascript) for algorithm precision.",
    ],
  },
  education: {
    label: "Education",
    hashtags: ["learnontiktok","edutok","didyouknow","funfacts","studytok","science","history","psychologyfacts","lifelessons","mindblown","studywithme","learning","knowledge","factcheck","educationalcontent"],
    tips: [
      "#learnontiktok and #edutok are TikTok-endorsed education hubs — always include both.",
      "Hook your video with a surprising fact, then use #didyouknow and #mindblown.",
      "#studywithme drives long watch-time sessions — great for boosting account ranking.",
    ],
  },
  finance: {
    label: "Finance",
    hashtags: ["personalfinance","moneytok","investing","financetok","stockmarket","budgeting","financialfreedom","savingmoney","passiveincome","wealthbuilding","crypto","daytrading","sidehustle","moneyadvice","financialliteracy"],
    tips: [
      "#sidehustle has extraordinary reach-to-follower conversion — strong CTA opportunity.",
      "#financialliteracy signals educational intent and builds authority faster than broad tags.",
      "Combine #personalfinance + #moneytok as your consistent anchor pair.",
    ],
  },
  fashion: {
    label: "Fashion",
    hashtags: ["fashiontok","outfitoftheday","ootd","styletips","fashioninspo","streetstyle","outfitinspiration","fashiontrends","thriftflip","stylechallenge","fashionover40","capsulewardrobe","sustainablefashion","fashionreview","outfitcheck"],
    tips: [
      "#thriftflip is a high-engagement format with built-in transformation payoff.",
      "#capsulewardrobe drives saves — viewers return to reference your content.",
      "#ootd and #outfitoftheday together cover both search and FYP distribution.",
    ],
  },
  lifestyle: {
    label: "Lifestyle",
    hashtags: ["lifestyletok","dayinmylife","morningroutine","selfcare","productividad","slowliving","minimalismlifestyle","wellbeing","lifestylegoals","selfimprovement","nightroutine","workfromhome","adulting","lifehacks","positivevibes"],
    tips: [
      "#dayinmylife is the highest-retention lifestyle format — use it for your best content.",
      "#morningroutine and #nightroutine create episodic content that grows followers.",
      "#selfimprovement has strong crossover with finance and education audiences.",
    ],
  },
  gaming: {
    label: "Gaming",
    hashtags: ["gamingtok","gamertok","gaming","gameplay","gamer","twitch","streamer","esports","pcgaming","consolegaming","gamingsetup","videogames","fps","rpggames","gamingnews"],
    tips: [
      "#gamingtok and #gamertok are TikTok-native — use both over generic #gaming.",
      "Platform-specific tags (#pcgaming, #consolegaming) attract more loyal sub-audiences.",
      "#gamingsetup is a high-save aspirational format — great for gear showcase content.",
    ],
  },
  motivation: {
    label: "Motivation",
    hashtags: ["motivationtok","motivation","inspiration","mindset","successmindset","grindset","hustle","growthmindset","selfmotivation","dailymotivation","motivationalquotes","entrepreneur","mentalhealthawareness","positivity","nevergiveup"],
    tips: [
      "Combine #mindset + #growthmindset for maximum psychology-audience penetration.",
      "#entrepreneur crossover dramatically expands reach beyond pure motivation audience.",
      "Use #motivationtok for FYP + #dailymotivation for search discovery.",
    ],
  },
  business: {
    label: "Business",
    hashtags: ["businesstok","entrepreneur","startuplife","smallbusiness","businessadvice","marketing","ecommerce","socialmediatips","contentcreator","brandbuilding","businessmindset","freelance","digitalmarketing","saas","b2b"],
    tips: [
      "#smallbusiness has massive organic reach — TikTok actively promotes small business content.",
      "#saas and #b2b are high-intent, low-competition — strong B2B lead generation tags.",
      "#digitalmarketing crossover reaches both business owners and marketers.",
    ],
  },
  pets: {
    label: "Pets",
    hashtags: ["pettok","dogsoftiktok","catsoftiktok","petlover","funnypets","dogmom","catmom","petcare","animalsoftiktok","dogtraining","cuteanimals","petsofinstagram","bunnytok","reptiletek","petadvice"],
    tips: [
      "#dogsoftiktok and #catsoftiktok are two of TikTok's most engaged communities.",
      "#dogtraining content saves extremely well — strong algorithm signal.",
      "Species-specific niche tags (#bunnytok, #reptiletek) unlock dedicated micro-communities.",
    ],
  },
  music: {
    label: "Music",
    hashtags: ["musictok","musician","originalmusic","coversong","singertok","producertok","musicproduction","guitarplayer","pianotok","beatmaker","indieartist","newmusic","musiciansoftiktok","songwriting","musicvideo"],
    tips: [
      "#originalmusic tags signal creative ownership — stronger for artist brand building.",
      "#coversong drives discovery — viewers search for specific song covers regularly.",
      "#producertok and #beatmaker have a highly engaged niche with strong creator community.",
    ],
  },
  comedy: {
    label: "Comedy",
    hashtags: ["comedytok","funny","funnyvideo","humor","memes","relatable","skit","parody","standup","comedyskits","funnymoments","fail","adulthumor","darkhumor","comedylife"],
    tips: [
      "#relatable is comedy's highest-engagement crossover tag — always include it.",
      "#skit and #parody signal a content format — helps algorithm categorize and distribute.",
      "Keep hooks under 2 seconds for comedy — if they're not laughing in 2s, they've scrolled.",
    ],
  },
};

const HOOKS = {
  Curiosity: [
    { formula: "Nobody talks about [topic] but it changed everything for me", tip: "Positions your content as hidden knowledge — triggers FOMO." },
    { formula: "The [adjective] truth about [topic] that [authority] won't tell you", tip: "Us-vs-them dynamic drives curiosity and shares." },
    { formula: "I tried [thing] for [duration] — here's what actually happened", tip: "First-person experiments feel authentic and are highly shareable." },
  ],
  Controversy: [
    { formula: "[Popular belief] is a lie. Here's the truth.", tip: "Challenge a widely-held belief to trigger immediate reactions." },
    { formula: "Unpopular opinion: [contrarian take] (and I have receipts)", tip: "Label it 'unpopular opinion' so people feel compelled to agree or disagree." },
    { formula: "Why I quit [respected thing] — and I'm not going back", tip: "Quitting something respected makes viewers defensive and curious." },
  ],
  Relatability: [
    { formula: "POV: You're a [identity] who [relatable situation]", tip: "POV format puts viewers in the scene and builds instant connection." },
    { formula: "Me at [time/age] vs. me after [discovery/change]", tip: "Before/after framing is universally relatable and sparks aspiration." },
    { formula: "If you [relatable experience], this video is for you", tip: "Address your niche pain point directly to filter the perfect audience." },
  ],
  Authority: [
    { formula: "After [large number] [units], here's what I know about [topic]", tip: "Large numbers signal deep experience." },
    { formula: "[Number] things [expert role] never tell clients about [topic]", tip: "Insider secrets trigger fear of missing out." },
    { formula: "I studied [topic] for [duration] so you don't have to", tip: "Positions you as the researcher — saves the viewer time." },
  ],
  Urgency: [
    { formula: "Stop doing [common action] if you want [desired outcome]", tip: "Telling people to 'stop' is more compelling than 'start'." },
    { formula: "You have [timeframe] to [action] before [consequence]", tip: "Hard deadlines activate loss aversion." },
    { formula: "Most people don't know [time-sensitive thing] — watch this now", tip: "Combine scarcity with authority for maximum urgency." },
  ],
  Story: [
    { formula: "At [low point], I [desperate action]. What happened next changed everything.", tip: "Open with your lowest point to hook viewers emotionally from second one." },
    { formula: "Nobody believed I could [goal]. Here's how I proved them wrong.", tip: "Underdog framing earns instant emotional investment." },
    { formula: "This is the story of how [transformation] in [short timeframe]", tip: "Compressed transformation timelines trigger disbelief that demands watching." },
  ],
  List: [
    { formula: "[Number] [topic] mistakes that are silently [negative consequence]", tip: "Mistakes perform better than tips — people fear loss more than they desire gain." },
    { formula: "[Number] signs you're [diagnosis] (most people miss #[specific number])", tip: "The parenthetical creates curiosity about a specific item." },
    { formula: "[Number] things I wish I knew about [topic] before [experience]", tip: "Regret framing makes content feel like a gift to the viewer." },
  ],
  Challenge: [
    { formula: "I challenged myself to [extreme action] for [duration] — day [number]", tip: "Challenge series create follow-back loops — viewers return for updates." },
    { formula: "Can [simple person] do [expert thing] in [short time]? Watch.", tip: "Stakes + skepticism = built-in tension that demands resolution." },
    { formula: "I spent [amount] on [experience]. Was it worth it?", tip: "Money spent creates instant investment — viewers want to know the verdict." },
  ],
};

// ─── Tool logic (mirrors tiktapdown-mcp tool implementations) ────────────────

function getHashtags(niche) {
  const data = NICHES[niche];
  if (!data) {
    const available = Object.keys(NICHES).join(", ");
    throw new HttpsError("invalid-argument", `Unknown niche '${niche}'. Available: ${available}`);
  }
  return {
    niche,
    label: data.label,
    hashtags: data.hashtags,
    hashtagString: data.hashtags.map(h => `#${h}`).join(" "),
    tips: data.tips,
  };
}

function getHooks(category) {
  const data = HOOKS[category];
  if (!data) {
    const available = Object.keys(HOOKS).join(", ");
    throw new HttpsError("invalid-argument", `Unknown hook category '${category}'. Available: ${available}`);
  }
  return data.map(h => ({ formula: h.formula, tip: h.tip }));
}

// ─── Firebase Callable Function ────────────────────────────────────────────────

/**
 * generateCaption — callable from the client via firebase.functions().httpsCallable()
 *
 * Input:  { niche, hookCategory, topic, memberKey }
 * Output: { draftId, hashtags, hashtagString, hooks, caption, tips, createdAt }
 *
 * Saves a draft to Firestore at: caption_drafts/{draftId}
 */
exports.generateCaption = onCall({ cors: true }, async (request) => {
  const { niche, hookCategory, topic, memberKey } = request.data || {};

  if (!niche || !hookCategory || !topic) {
    throw new HttpsError("invalid-argument", "niche, hookCategory, and topic are required.");
  }
  if (topic.length > 300) {
    throw new HttpsError("invalid-argument", "topic must be 300 characters or fewer.");
  }

  // ── get_tiktok_hashtags ──────────────────────────────────────────────────
  const hashtagData = getHashtags(niche);

  // ── generate_tiktok_hook ─────────────────────────────────────────────────
  const hookTemplates = getHooks(hookCategory);

  // Build a ready-to-copy caption (hook line 1 + top 10 hashtags)
  const topHook = hookTemplates[0].formula;
  const top10tags = hashtagData.hashtags.slice(0, 10).map(h => `#${h}`).join(" ");
  const caption = `${topHook}\n\n${topic}\n\n${top10tags}`;

  // ── Save to Firestore ────────────────────────────────────────────────────
  const draft = {
    memberKey: memberKey || "anonymous",
    niche,
    nichLabel: hashtagData.label,
    hookCategory,
    topic,
    hashtags: hashtagData.hashtags,
    hashtagString: hashtagData.hashtagString,
    hooks: hookTemplates,
    caption,
    tips: hashtagData.tips,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const ref = await db.collection("caption_drafts").add(draft);

  return {
    draftId: ref.id,
    hashtags: hashtagData.hashtags,
    hashtagString: hashtagData.hashtagString,
    hooks: hookTemplates,
    caption,
    tips: hashtagData.tips,
  };
});
