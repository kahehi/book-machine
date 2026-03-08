import type { LlmClient, LlmMessage } from './llmClient.js';

// ─── Mock Responses ────────────────────────────────────────────────────────────

const MOCK_PLANNER = {
  seriesTitle: 'Traumland-Geschichten',
  targetAge: '4-7 Jahre',
  tone: 'warm, beruhigend, liebevoll',
  bookCount: 10,
  books: [
    {
      title: 'Leo und die tapfere Nacht',
      hook: 'Ein kleiner Löwe entdeckt, dass Mut im Herzen wächst, wenn man ihm Raum gibt.',
      theme: 'Angst überwinden, Mut und Selbstvertrauen',
    },
    {
      title: 'Mia und das Wolkenschiff',
      hook: 'Ein Mädchen lernt, dass Träume real werden, wenn man an sie glaubt.',
      theme: 'Fantasie, Kreativität und Vertrauen',
    },
    {
      title: 'Der Mond und sein Geheimnis',
      hook: 'Der Mond flüstert jedem Kind eine Gutenacht-Geschichte.',
      theme: 'Geborgenheit, Liebe und Einschlafen',
    },
    {
      title: 'Finn und der sprechende Wald',
      hook: 'Ein neugieriger Junge entdeckt, dass die Natur ihre eigene Sprache spricht.',
      theme: 'Naturverbundenheit, Staunen und Freundschaft',
    },
    {
      title: 'Emma und die Sternenbrücke',
      hook: 'Ein Mädchen baut eine Brücke aus Sternen, um ihre beste Freundin zu finden.',
      theme: 'Freundschaft, Zusammenhalt und Mut',
    },
    {
      title: 'Tom und die Zaubermuschel',
      hook: 'Eine Muschel flüstert Tom das Lied des Meeres – und bringt ihn sicher nach Hause.',
      theme: 'Geborgenheit, Vertrauen und Heimweh',
    },
    {
      title: 'Clara und der singende Wind',
      hook: 'Der Wind trägt Claras Wünsche in die Welt – und bringt Antworten zurück.',
      theme: 'Mut, Neugier und innere Stimme',
    },
    {
      title: 'Ben und das goldene Buch',
      hook: 'Ein Buch öffnet sich nur für den, der wirklich zuhören kann.',
      theme: 'Fantasie, Lesen und Geduld',
    },
    {
      title: 'Lili und der Regenbogen',
      hook: 'Nach dem Regen zeigt Lili, dass Farben heilen können.',
      theme: 'Fröhlichkeit, Hoffnung und Trost',
    },
    {
      title: 'Max und der schlafende Drache',
      hook: 'Max findet einen Drachen, der nicht feuerspeit, sondern träumt.',
      theme: 'Respekt, Koexistenz und Sanftheit',
    },
  ],
};

const MOCK_REALITY_CHECK = {
  risks: [
    {
      category: 'Sprache',
      severity: 'low' as const,
      description: 'Einzelne Sätze könnten für 4-Jährige zu lang sein.',
      mitigation: 'Sätze auf maximal 8 Wörter kürzen.',
    },
    {
      category: 'Safety',
      severity: 'low' as const,
      description: 'Kein medizinischer Inhalt, keine coerciven Suggestionen gefunden.',
      mitigation: 'Weiterhin auf neutrale Sprache achten.',
    },
  ],
  platformNotes: [
    'Geeignet für Amazon KDP Kinderbuchformat (32 Seiten).',
    'Bilder-Prompts sind plattformneutral formuliert.',
    'Keine urheberrechtlich geschützten Figuren enthalten.',
  ],
};

const MOCK_STORY_V1 = {
  bookId: 'book1',
  title: 'Leo und die tapfere Nacht',
  pages: [
    {
      pageNo: 1,
      textDe:
        'Leo liegt in seinem Bett. Das Zimmer ist dunkel. Leo kann nicht einschlafen.',
      imagePromptEn:
        'A small lion cub lying awake in bed at night, wide eyes, soft moonlight through curtains, watercolor illustration, cozy bedroom',
    },
    {
      pageNo: 2,
      textDe:
        'Mama Löwin kommt herein. Sie lächelt warm. „Schau mal, was ich habe", sagt sie.',
      imagePromptEn:
        'A gentle mama lion entering a cozy bedroom, warm smile, holding a small glowing star, soft golden light, watercolor style',
    },
    {
      pageNo: 3,
      textDe:
        'Mama gibt Leo einen kleinen Stern. Der Stern leuchtet sanft. Leo hält ihn fest.',
      imagePromptEn:
        'A lion cub receiving a small glowing star from his mama, hands cupped around it, warm golden glow, peaceful expression',
    },
    {
      pageNo: 4,
      textDe:
        'Leo schaut zur Wand. Große Schatten tanzen dort. Leo erschrickt ein bisschen.',
      imagePromptEn:
        'Large friendly shadow shapes on a bedroom wall, a small lion cub looking at them curiously, soft candlelight atmosphere',
    },
    {
      pageNo: 5,
      textDe:
        'Leo atmet tief ein. Einmal. Zweimal. Dreimal. „Ich bin mutig", flüstert er.',
      imagePromptEn:
        'A brave little lion cub taking a deep breath, eyes gently closed, calm peaceful expression, soft warm light around him',
    },
    {
      pageNo: 6,
      textDe:
        'Die Schatten sind gar nicht schlimm. Sie sehen aus wie Hasen und Bären. Leo lacht leise.',
      imagePromptEn:
        'Friendly shadow puppets of a rabbit and bear on a bedroom wall, a lion cub giggling with delight, cozy warm atmosphere',
    },
    {
      pageNo: 7,
      textDe:
        'Leo legt den Stern auf den Nachttisch. Er kuschelt sich in die Decke. Sein Herz ist warm.',
      imagePromptEn:
        'A lion cub snuggling under a blanket in bed, a small glowing star on the nightstand, content smile, cozy and safe feeling',
    },
    {
      pageNo: 8,
      textDe:
        'Leo schließt die Augen. Der Stern wacht über ihn. Gute Nacht, tapferer Leo.',
      imagePromptEn:
        'A sleeping lion cub in bed, a glowing star on nightstand, soft moonlight, dreamy and peaceful illustration, watercolor style',
    },
  ],
};

const MOCK_STORY_BOOK2_V1 = {
  bookId: 'book2',
  title: 'Mia und das Wolkenschiff',
  pages: [
    {
      pageNo: 1,
      textDe: 'Mia schaut aus dem Fenster. Die Wolken ziehen vorbei. Eine Wolke sieht aus wie ein Schiff.',
      imagePromptEn: 'A little girl looking out a window at fluffy clouds, one cloud shaped like a sailing ship, soft pastel colors, watercolor illustration',
    },
    {
      pageNo: 2,
      textDe: 'Das Schiff kommt näher. Es ist riesig und weiß. Mia streckt die Hand aus.',
      imagePromptEn: 'A magnificent white cloud ship floating close to a window, a small girl reaching out her hand, dreamy watercolor style',
    },
    {
      pageNo: 3,
      textDe: 'Eine Leiter hängt herunter. Mia klettert hinauf. Das Schiff trägt sie sanft.',
      imagePromptEn: 'A young girl climbing a rope ladder up into a fluffy cloud ship, soft golden sunset light, magical atmosphere, watercolor',
    },
    {
      pageNo: 4,
      textDe: 'Von oben sieht die Welt winzig aus. Häuser wie Spielzeug. Bäume wie Punkte.',
      imagePromptEn: 'View from a cloud ship looking down at tiny houses and trees, a little girl leaning over the edge with wonder, watercolor illustration',
    },
    {
      pageNo: 5,
      textDe: 'Ein Stern winkt ihr zu. Mia winkt zurück. „Du glaubst an mich", sagt der Stern.',
      imagePromptEn: 'A friendly glowing star waving at a little girl on a cloud ship, warm golden light, magical and peaceful watercolor scene',
    },
    {
      pageNo: 6,
      textDe: 'Das Schiff fährt langsam heim. Der Mond leuchtet. Mia ist müde und glücklich.',
      imagePromptEn: 'A cloud ship sailing back home under a bright moon, a sleepy little girl sitting on deck, soft blue and gold watercolor tones',
    },
    {
      pageNo: 7,
      textDe: 'Mia landet sanft in ihrem Bett. Die Wolke winkt noch einmal. Dann ist sie weg.',
      imagePromptEn: 'A little girl gently landing back in her cozy bed from a cloud, the cloud waving goodbye through the window, dreamy watercolor',
    },
    {
      pageNo: 8,
      textDe: 'Mia lächelt. Träume werden wahr. Wenn man nur glaubt. Gute Nacht, Mia.',
      imagePromptEn: 'A little girl sleeping peacefully in bed, a small cloud visible through the window, soft moonlight, gentle watercolor illustration',
    },
  ],
};

const MOCK_STORY_BOOK3_V1 = {
  bookId: 'book3',
  title: 'Der Mond und sein Geheimnis',
  pages: [
    {
      pageNo: 1,
      textDe: 'Der Mond schaut ins Kinderzimmer. Er sieht viele schlafende Kinder. Nur eines ist noch wach.',
      imagePromptEn: 'A round glowing moon peeking through a window into a nursery, one child still awake, soft blue and silver watercolor',
    },
    {
      pageNo: 2,
      textDe: 'Das Kind heißt Lena. Lena kann nicht einschlafen. „Mond", flüstert sie, „was ist dein Geheimnis?"',
      imagePromptEn: 'A small girl whispering to the moon through her bedroom window, moonlight on her face, cozy and magical watercolor illustration',
    },
    {
      pageNo: 3,
      textDe: 'Der Mond lächelt. „Ich passe auf euch auf", sagt er leise. „Jede Nacht. Immer."',
      imagePromptEn: 'The moon with a gentle smiling face, soft silver glow, speaking to a little girl, warm and comforting watercolor scene',
    },
    {
      pageNo: 4,
      textDe: 'Lena schaut nach draußen. Sterne tanzen um den Mond. Sie winken ihr zu.',
      imagePromptEn: 'Stars dancing around the moon in a night sky, a little girl watching from her window with delight, dreamy watercolor illustration',
    },
    {
      pageNo: 5,
      textDe: '„Du bist nie allein", sagt der Mond. Lena fühlt sich warm und sicher.',
      imagePromptEn: 'A glowing moon speaking to a child, warm silver light wrapping around her like a blanket, safe and cozy watercolor',
    },
    {
      pageNo: 6,
      textDe: 'Der Mond singt ein Lied. Ganz leise. Die Sterne summen mit. Lena lauscht.',
      imagePromptEn: 'The moon singing softly, stars humming along, a little girl listening with closed eyes and a smile, peaceful watercolor scene',
    },
    {
      pageNo: 7,
      textDe: 'Lenas Augen werden schwer. Der Mond wacht. Die Sterne wachen. Alles ist gut.',
      imagePromptEn: 'A little girl with heavy eyelids drifting to sleep, the moon and stars keeping watch outside, soft silver and blue watercolor',
    },
    {
      pageNo: 8,
      textDe: 'Lena schläft. Der Mond lächelt. Das ist sein schönstes Geheimnis. Gute Nacht.',
      imagePromptEn: 'A sleeping child under a blanket, the smiling moon outside the window, a sky full of stars, dreamy peaceful watercolor',
    },
  ],
};

const MOCK_STORY_BOOK4_V1 = {
  bookId: 'book4',
  title: 'Finn und der sprechende Wald',
  pages: [
    {
      pageNo: 1,
      textDe: 'Finn geht in den Wald. Es ist still. Nur der Wind rauscht leise durch die Bäume.',
      imagePromptEn: 'A curious boy entering a lush green forest, trees tall and majestic, soft dappled light, peaceful watercolor illustration',
    },
    {
      pageNo: 2,
      textDe: 'Eine Eiche flüstert: „Willkommen." Finn erschrickt. Dann lacht er.',
      imagePromptEn: 'A large oak tree with a gentle face whispering to a young boy, magical forest atmosphere, warm watercolor illustration',
    },
    {
      pageNo: 3,
      textDe: 'Ein Eichhörnchen springt auf seinen Arm. „Ich bin Nuss", sagt es. „Dein Freund."',
      imagePromptEn: 'A friendly squirrel jumping onto a boys arm in a forest, both looking at each other with delight, soft watercolor style',
    },
    {
      pageNo: 4,
      textDe: 'Nuss zeigt ihm den Weg. Tief in den Wald. Dort, wo die alten Bäume stehen.',
      imagePromptEn: 'A squirrel leading a boy deeper into a magical forest, ancient tall trees all around, golden light filtering through, watercolor',
    },
    {
      pageNo: 5,
      textDe: 'Die alten Bäume erzählen Geschichten. Von Regen und Sonne. Von hundert Jahren.',
      imagePromptEn: 'Ancient trees with wise faces telling stories to a young boy and squirrel, magical forest glow, rich watercolor illustration',
    },
    {
      pageNo: 6,
      textDe: 'Finn setzt sich hin. Er hört zu. Der Wald atmet. Finn atmet mit.',
      imagePromptEn: 'A boy sitting at the base of a great tree, eyes closed, listening, the forest breathing around him, serene watercolor',
    },
    {
      pageNo: 7,
      textDe: 'Es wird dunkel. Die Bäume leuchten. Sie zeigen Finn den Weg nach Hause.',
      imagePromptEn: 'Trees glowing softly in the dark forest, guiding a boy home, magical and warm watercolor illustration',
    },
    {
      pageNo: 8,
      textDe: 'Finn liegt im Bett. Er lächelt. Er weiß jetzt: Die Natur ist sein Freund. Gute Nacht.',
      imagePromptEn: 'A boy sleeping in bed with a smile, a small acorn on the nightstand, a forest visible through the moonlit window, watercolor',
    },
  ],
};

const MOCK_STORY_BOOK2_V2 = {
  bookId: 'book2',
  title: 'Mia und das Wolkenschiff',
  pages: [
    {
      pageNo: 1,
      textDe: 'Mia liegt im Bett. Sie schaut zum Fenster. Eine Wolke sieht aus wie ein Schiff.',
      imagePromptEn: 'A little girl lying in bed looking at a cloud shaped like a ship through her window, soft pastel colors, watercolor illustration',
    },
    {
      pageNo: 2,
      textDe: 'Das Schiff kommt näher. Mia hält die Luft an. Dann streckt sie mutig die Hand aus.',
      imagePromptEn: 'A cloud ship drifting close to a window, a brave little girl reaching out her hand, warm dreamy watercolor',
    },
    {
      pageNo: 3,
      textDe: 'Mia klettert hinauf. Der Wind ist sanft. Das Schiff trägt sie hoch in den Himmel.',
      imagePromptEn: 'A girl climbing up into a fluffy cloud ship, the wind lifting her gently, magical golden sky, watercolor',
    },
    {
      pageNo: 4,
      textDe: 'Unter ihr liegt die Stadt. Alles leuchtet. Mia lacht vor Freude.',
      imagePromptEn: 'A city glowing below a cloud ship at dusk, a delighted little girl looking down, warm watercolor illustration',
    },
    {
      pageNo: 5,
      textDe: 'Ein Stern kommt geflogen. „Glaub an dich", sagt er. Mia nickt.',
      imagePromptEn: 'A glowing star flying up to a little girl on a cloud ship, speaking to her gently, magical warm watercolor scene',
    },
    {
      pageNo: 6,
      textDe: 'Das Schiff dreht um. Es wird Nacht. Die Sterne zeigen den Weg.',
      imagePromptEn: 'A cloud ship turning homeward under a starry sky, stars lighting the path, soft blue and silver watercolor',
    },
    {
      pageNo: 7,
      textDe: 'Mia landet leise in ihrem Zimmer. Sie ist müde. Ihr Herz ist voll.',
      imagePromptEn: 'A little girl landing softly in her room from a cloud, tired but happy, cozy bedroom in watercolor',
    },
    {
      pageNo: 8,
      textDe: 'Mia schläft. Sie lächelt. Träume warten schon. Gute Nacht, Mia.',
      imagePromptEn: 'A little girl sleeping with a smile, soft moonlight through the window, dreamy peaceful watercolor illustration',
    },
  ],
};

const MOCK_STORY_BOOK3_V2 = {
  bookId: 'book3',
  title: 'Der Mond und sein Geheimnis',
  pages: [
    {
      pageNo: 1,
      textDe: 'Es ist Nacht. Alle schlafen. Nur Lena liegt wach und schaut zum Mond.',
      imagePromptEn: 'A little girl awake in bed looking at the moon through her window, everyone else asleep, soft blue watercolor',
    },
    {
      pageNo: 2,
      textDe: '„Mond", flüstert Lena, „kannst du mich hören?" Der Mond leuchtet heller.',
      imagePromptEn: 'A little girl whispering to the moon, the moon glowing brighter in response, magical silver watercolor scene',
    },
    {
      pageNo: 3,
      textDe: '„Ich bin immer da", sagt der Mond leise. „Auch wenn du mich nicht siehst."',
      imagePromptEn: 'The moon speaking gently to a child, a warm silver glow surrounding her, safe and comforting watercolor',
    },
    {
      pageNo: 4,
      textDe: 'Sterne zünden sich an. Einer nach dem anderen. Der Himmel wird warm.',
      imagePromptEn: 'Stars lighting up one by one in a night sky, a little girl watching in wonder, warm and magical watercolor',
    },
    {
      pageNo: 5,
      textDe: 'Lena fühlt sich geborgen. So wie in Mamas Armen. Nur größer.',
      imagePromptEn: 'A child wrapped in soft moonlight like a hug, peaceful and safe expression, gentle watercolor illustration',
    },
    {
      pageNo: 6,
      textDe: 'Der Mond erzählt eine Geschichte. Von Kindern auf der ganzen Welt. Alle schlafen.',
      imagePromptEn: 'The moon over many sleeping children around the world, a storytelling glow, soft global watercolor scene',
    },
    {
      pageNo: 7,
      textDe: 'Lenas Augen werden schwer. Der Mond lächelt. „Schlaf gut, kleine Lena."',
      imagePromptEn: 'A little girl with drooping eyes as the moon smiles at her warmly, silver light on her face, peaceful watercolor',
    },
    {
      pageNo: 8,
      textDe: 'Lena schläft tief. Der Mond wacht. Das ist sein schönstes Geheimnis. Gute Nacht.',
      imagePromptEn: 'A sleeping girl under a blanket, the moon watching over her through the window, starry sky, dreamy watercolor',
    },
  ],
};

const MOCK_STORY_BOOK4_V2 = {
  bookId: 'book4',
  title: 'Finn und der sprechende Wald',
  pages: [
    {
      pageNo: 1,
      textDe: 'Finn liegt im Bett. Er denkt an den Wald. Er will morgen wieder hin.',
      imagePromptEn: 'A boy lying in bed thinking about a forest, dreamy forest images floating above him, soft watercolor illustration',
    },
    {
      pageNo: 2,
      textDe: 'Da hört er etwas. Ein Rascheln. Ein Flüstern. Der Wald ist schon da.',
      imagePromptEn: 'A boy sitting up in bed listening, leaves rustling at the window, a magical forest appearing outside, watercolor',
    },
    {
      pageNo: 3,
      textDe: '„Nuss!", ruft Finn leise. Das Eichhörnchen sitzt auf dem Fensterbrett.',
      imagePromptEn: 'A small squirrel sitting on a windowsill, a happy boy reaching out to it, warm room light, watercolor illustration',
    },
    {
      pageNo: 4,
      textDe: '„Wir haben auf dich gewartet", sagt Nuss. Die Bäume nicken draußen.',
      imagePromptEn: 'Trees outside a window nodding gently, a squirrel speaking to a boy, magical forest atmosphere, warm watercolor',
    },
    {
      pageNo: 5,
      textDe: 'Finn schließt die Augen. Er riecht Erde und Moos. Er hört Blätter tanzen.',
      imagePromptEn: 'A boy with closed eyes smelling the forest, leaves dancing around him, peaceful and magical watercolor scene',
    },
    {
      pageNo: 6,
      textDe: '„Der Wald träumt mit dir", sagt die alte Eiche. Finn lächelt.',
      imagePromptEn: 'An ancient oak tree speaking softly to a smiling boy, forest dream imagery, rich warm watercolor illustration',
    },
    {
      pageNo: 7,
      textDe: 'Finn legt sich hin. Der Wald singt. Leise, leise. Wie ein Lied ohne Worte.',
      imagePromptEn: 'A boy lying back peacefully, the forest singing around him, leaves swaying gently, serene watercolor',
    },
    {
      pageNo: 8,
      textDe: 'Finn schläft. Nuss wacht. Der Wald atmet. Gute Nacht, Finn.',
      imagePromptEn: 'A sleeping boy with a squirrel watching over him, moonlit forest outside the window, peaceful watercolor illustration',
    },
  ],
};

const MOCK_STORY_BOOK5_V1 = {
  bookId: 'book5',
  title: 'Emma und die Sternenbrücke',
  pages: [
    { pageNo: 1, textDe: 'Emma schaut aus dem Fenster. Der Himmel ist voller Sterne. Einer fehlt.', imagePromptEn: 'A little girl looking out her window at a starry sky, one star missing, soft blue watercolor illustration' },
    { pageNo: 2, textDe: 'Emma fragt den Mond: „Wo ist mein Stern?" Der Mond lächelt. „Bei deiner Freundin."', imagePromptEn: 'A little girl talking to the moon, the moon smiling gently, cozy night atmosphere, watercolor' },
    { pageNo: 3, textDe: 'Emma beginnt zu bauen. Aus Träumen und Wünschen. Eine Brücke aus Sternen.', imagePromptEn: 'A girl building a bridge from glowing stars in the night sky, magical and dreamy watercolor scene' },
    { pageNo: 4, textDe: 'Schritt für Schritt. Die Brücke wächst. Emma ist mutig.', imagePromptEn: 'A brave little girl stepping across a shimmering star bridge in the night sky, watercolor illustration' },
    { pageNo: 5, textDe: 'Am Ende wartet ihre Freundin. Sie lacht. Sie streckt die Hände aus.', imagePromptEn: 'Two little girls reaching for each other across a star bridge in the sky, joyful expressions, warm watercolor' },
    { pageNo: 6, textDe: 'Die Freundinnen sitzen zusammen. Hoch oben. Unter Millionen Sternen.', imagePromptEn: 'Two girls sitting together on a star bridge, millions of stars around them, peaceful and happy watercolor' },
    { pageNo: 7, textDe: 'Emma ist nicht mehr allein. Freundschaft leuchtet heller als jeder Stern.', imagePromptEn: 'Two girls hugging on a star bridge, their friendship glowing brighter than the stars, warm watercolor scene' },
    { pageNo: 8, textDe: 'Emma schläft ein. Sie lächelt. Ihre Freundin ist nah. Gute Nacht, Emma.', imagePromptEn: 'A little girl sleeping peacefully, a star bridge glowing softly outside her window, dreamy watercolor illustration' },
  ],
};

const MOCK_STORY_BOOK6_V1 = {
  bookId: 'book6',
  title: 'Tom und die Zaubermuschel',
  pages: [
    { pageNo: 1, textDe: 'Tom sitzt am Strand. Er ist allein. Die Wellen rauschen leise.', imagePromptEn: 'A little boy sitting alone on a beach, gentle waves, soft pastel colors, watercolor illustration' },
    { pageNo: 2, textDe: 'Er findet eine Muschel. Sie glitzert. Tom hält sie ans Ohr.', imagePromptEn: 'A boy holding a magical glittering shell to his ear, curious expression, beach setting, soft watercolor' },
    { pageNo: 3, textDe: 'Die Muschel singt. Ein Lied vom Meer. Tom kennt es. Es klingt wie Zuhause.', imagePromptEn: 'A glowing shell singing, musical notes floating around a boy on the beach, warm and magical watercolor' },
    { pageNo: 4, textDe: 'Das Meer flüstert: „Du bist nicht verloren. Ich zeige dir den Weg."', imagePromptEn: 'The sea speaking gently to a little boy, soft waves forming a guiding path, serene watercolor scene' },
    { pageNo: 5, textDe: 'Tom folgt dem Lied. Über Sand und Steine. Schritt für Schritt.', imagePromptEn: 'A boy following a glowing musical path over sand and stones, evening light, watercolor illustration' },
    { pageNo: 6, textDe: 'Da sieht er das Licht. Sein Zuhause. Mama winkt vom Fenster.', imagePromptEn: 'A boy seeing his home with warm light in the window, his mother waving, safe and cozy watercolor scene' },
    { pageNo: 7, textDe: 'Tom läuft. Er lacht. Die Muschel singt ein letztes Mal. Dann ist es still.', imagePromptEn: 'A boy running home happily, a shell glowing in his hand, soft golden light, joyful watercolor illustration' },
    { pageNo: 8, textDe: 'Tom liegt im Bett. Die Muschel liegt neben ihm. Gute Nacht, Tom.', imagePromptEn: 'A boy sleeping in bed with a magical shell beside him, soft moonlight, peaceful watercolor illustration' },
  ],
};

const MOCK_STORY_BOOK7_V1 = {
  bookId: 'book7',
  title: 'Clara und der singende Wind',
  pages: [
    { pageNo: 1, textDe: 'Clara sitzt auf der Wiese. Der Wind weht. Er klingt fast wie Musik.', imagePromptEn: 'A little girl sitting on a meadow, wind blowing gently through her hair, soft pastel watercolor illustration' },
    { pageNo: 2, textDe: 'Clara flüstert ihren Wunsch in den Wind. Der Wind hört zu. Er dreht sich.', imagePromptEn: 'A girl whispering to the wind, the wind swirling around her like a gentle spiral, magical watercolor' },
    { pageNo: 3, textDe: 'Der Wind trägt ihren Wunsch weit fort. Über Berge und Meere.', imagePromptEn: 'A wish floating on the wind over mountains and seas, soft dreamy watercolor scene, bird-eye view' },
    { pageNo: 4, textDe: 'Clara wartet. Ganz ruhig. Sie hört auf ihre innere Stimme.', imagePromptEn: 'A girl sitting quietly, eyes closed, listening to herself, peaceful meadow, warm watercolor illustration' },
    { pageNo: 5, textDe: 'Der Wind kommt zurück. Er bringt eine Antwort. Clara lächelt.', imagePromptEn: 'The wind returning to a girl with a glowing answer floating in it, soft magical watercolor scene' },
    { pageNo: 6, textDe: 'Die Antwort war immer in ihr. Der Wind hat sie nur sichtbar gemacht.', imagePromptEn: 'A girl with a warm glow inside her chest, the wind swirling around her gently, enlightened expression, watercolor' },
    { pageNo: 7, textDe: 'Clara tanzt mit dem Wind. Sie ist frei. Sie ist mutig. Sie ist sie selbst.', imagePromptEn: 'A girl dancing joyfully with the wind in a sunlit meadow, free and happy, vibrant watercolor illustration' },
    { pageNo: 8, textDe: 'Clara schläft ein. Der Wind singt leise. Gute Nacht, Clara.', imagePromptEn: 'A girl sleeping peacefully, the wind humming softly outside her window, soft pastel watercolor illustration' },
  ],
};

const MOCK_STORY_BOOK8_V1 = {
  bookId: 'book8',
  title: 'Ben und das goldene Buch',
  pages: [
    { pageNo: 1, textDe: 'Ben findet ein Buch. Es ist golden. Er kann es nicht öffnen.', imagePromptEn: 'A boy holding a golden book that will not open, curious and puzzled expression, soft watercolor illustration' },
    { pageNo: 2, textDe: 'Ben liest den Titel laut vor. Das Buch leuchtet. Aber es bleibt zu.', imagePromptEn: 'A boy reading the title of a glowing golden book aloud, the book glowing brighter, magical watercolor' },
    { pageNo: 3, textDe: 'Oma sagt: „Hör zuerst zu. Dann öffnet es sich." Ben versteht nicht.', imagePromptEn: 'An old grandmother speaking wisely to a young boy, a golden book between them, cozy room watercolor' },
    { pageNo: 4, textDe: 'Ben setzt sich hin. Er atmet. Er hört auf die Stille.', imagePromptEn: 'A boy sitting quietly with closed eyes, listening to silence, a golden book in his lap, peaceful watercolor' },
    { pageNo: 5, textDe: 'Da hört er etwas. Ganz leise. Eine Geschichte beginnt in seinem Kopf.', imagePromptEn: 'A story beginning to unfold in a boy\'s imagination, golden light and images floating around him, watercolor' },
    { pageNo: 6, textDe: 'Das Buch öffnet sich. Die Seiten leuchten. Jede Seite ist anders.', imagePromptEn: 'A golden book opening to reveal glowing, colorful pages, a boy\'s wide-eyed wonder, magical watercolor' },
    { pageNo: 7, textDe: 'Ben liest. Er staunt. Die Geschichte ist seine eigene.', imagePromptEn: 'A boy reading a magical book that shows his own life story in beautiful illustrations, watercolor' },
    { pageNo: 8, textDe: 'Ben schläft ein. Das Buch liegt offen. Gute Nacht, Ben.', imagePromptEn: 'A boy sleeping next to an open golden book glowing softly, moonlight, peaceful watercolor illustration' },
  ],
};

const MOCK_STORY_BOOK9_V1 = {
  bookId: 'book9',
  title: 'Lili und der Regenbogen',
  pages: [
    { pageNo: 1, textDe: 'Es hat geregnet. Lili schaut aus dem Fenster. Alles ist grau.', imagePromptEn: 'A little girl looking out a rainy window, grey skies, soft pastel watercolor illustration' },
    { pageNo: 2, textDe: 'Mama sagt: „Warte mal." Lili wartet. Dann – da ist er. Ein Regenbogen.', imagePromptEn: 'A rainbow appearing in the sky as a little girl watches from her window with wonder, gentle watercolor' },
    { pageNo: 3, textDe: 'Lili rennt hinaus. Der Regenbogen ist riesig. Er reicht bis zum Wald.', imagePromptEn: 'A girl running outside to a huge rainbow stretching to the forest, joyful expression, vibrant watercolor' },
    { pageNo: 4, textDe: 'Lili berührt das rote Ende. Es fühlt sich warm an. Wie Sommer.', imagePromptEn: 'A little girl touching the red end of a rainbow, a warm golden glow, soft summer watercolor scene' },
    { pageNo: 5, textDe: 'Jede Farbe erzählt eine Geschichte. Gelb ist Lachen. Blau ist Ruhe.', imagePromptEn: 'A girl touching different colors of a rainbow, each color evoking a different feeling, magical watercolor' },
    { pageNo: 6, textDe: 'Am Ende des Regenbogens liegt etwas Glänzendes. Lili hebt es auf.', imagePromptEn: 'A girl finding something shiny at the end of a rainbow, curious and delighted expression, watercolor illustration' },
    { pageNo: 7, textDe: 'Es ist ein Tropfen Licht. Lili steckt ihn in die Tasche. Für schwere Tage.', imagePromptEn: 'A girl gently putting a tiny drop of rainbow light into her pocket, warm and gentle watercolor scene' },
    { pageNo: 8, textDe: 'Lili schläft ein. Der Regenbogen leuchtet noch ein bisschen. Gute Nacht, Lili.', imagePromptEn: 'A girl sleeping peacefully, a faint rainbow visible through her window, soft pastel watercolor illustration' },
  ],
};

const MOCK_STORY_BOOK10_V1 = {
  bookId: 'book10',
  title: 'Max und der schlafende Drache',
  pages: [
    { pageNo: 1, textDe: 'Max geht durch den Wald. Er hört ein lautes Schnarchen. Was ist das?', imagePromptEn: 'A boy walking through a forest hearing a loud snoring sound, curious expression, soft watercolor illustration' },
    { pageNo: 2, textDe: 'Hinter einem Felsen liegt ein Drache. Er ist riesig. Er schläft tief.', imagePromptEn: 'A huge dragon sleeping peacefully behind a rock in a forest, a small boy watching in awe, watercolor' },
    { pageNo: 3, textDe: 'Max erschrickt. Dann schaut er genauer hin. Der Drache sieht... friedlich aus.', imagePromptEn: 'A boy looking carefully at a sleeping dragon, realizing it looks peaceful, soft and gentle watercolor scene' },
    { pageNo: 4, textDe: 'Max setzt sich daneben. Er hört dem Drachen beim Atmen zu. Ein, aus.', imagePromptEn: 'A boy sitting calmly beside a sleeping dragon, listening to its breathing, serene watercolor illustration' },
    { pageNo: 5, textDe: 'Der Drache öffnet ein Auge. Max bleibt ruhig. „Hallo", sagt Max leise.', imagePromptEn: 'A dragon opening one eye to look at a calm boy, a gentle meeting, warm watercolor illustration' },
    { pageNo: 6, textDe: 'Der Drache lächelt. Er atmet kein Feuer. Nur warme Luft. Wie ein Seufzen.', imagePromptEn: 'A dragon smiling gently and breathing warm air, not fire, a boy smiling back, peaceful watercolor' },
    { pageNo: 7, textDe: 'Max lehnt sich an den Drachen. Warm und sicher. Beide schauen in den Himmel.', imagePromptEn: 'A boy leaning against a dragon, both looking up at the sky together, calm and cozy watercolor scene' },
    { pageNo: 8, textDe: 'Max schläft ein. Der Drache wacht. Gute Nacht, Max.', imagePromptEn: 'A boy sleeping against a gentle dragon under the stars, the dragon watching over him, dreamy watercolor' },
  ],
};

const MOCK_STORY_BOOK5_V2 = {
  bookId: 'book5',
  title: 'Emma und die Sternenbrücke',
  pages: [
    { pageNo: 1, textDe: 'Emma liegt im Bett. Sie denkt an ihre Freundin. Sie vermisst sie.', imagePromptEn: 'A girl lying in bed thinking of her friend, a starry sky outside, soft blue watercolor illustration' },
    { pageNo: 2, textDe: 'Emma schaut zu den Sternen. „Könnt ihr helfen?" Die Sterne blinken.', imagePromptEn: 'A girl talking to the stars from her bed, stars blinking in response, magical gentle watercolor' },
    { pageNo: 3, textDe: 'Ein Stern kommt näher. Er zeigt ihr den Weg. Emma klettert hinauf.', imagePromptEn: 'A star floating close to a window, a girl climbing toward it, magical dreamy watercolor scene' },
    { pageNo: 4, textDe: 'Die Brücke trägt sie. Leicht wie Luft. Emma geht mutig weiter.', imagePromptEn: 'A girl walking on a bridge of light in the night sky, brave and calm, soft watercolor illustration' },
    { pageNo: 5, textDe: 'Ihre Freundin wartet. Sie winkt. Emma läuft.', imagePromptEn: 'Two girls running toward each other on a star bridge, joyful reunion, warm golden watercolor' },
    { pageNo: 6, textDe: 'Sie halten sich an den Händen. Die Sterne singen. Es ist wunderschön.', imagePromptEn: 'Two girls holding hands under singing stars, magical and peaceful watercolor scene' },
    { pageNo: 7, textDe: 'Echte Freundschaft braucht keine Brücke. Sie ist immer da.', imagePromptEn: 'Two friends connected by a glowing thread of friendship, stars all around, warm watercolor illustration' },
    { pageNo: 8, textDe: 'Emma schläft tief. Sie lächelt. Gute Nacht, Emma.', imagePromptEn: 'A girl sleeping with a smile, a star glowing on her nightstand, soft dreamy watercolor illustration' },
  ],
};

const MOCK_STORY_BOOK6_V2 = {
  bookId: 'book6',
  title: 'Tom und die Zaubermuschel',
  pages: [
    { pageNo: 1, textDe: 'Tom liegt im Bett. Er hält die Muschel. Sie leuchtet noch immer.', imagePromptEn: 'A boy lying in bed holding a glowing shell, soft warm light, peaceful watercolor illustration' },
    { pageNo: 2, textDe: 'Die Muschel singt leise. Ein Schlaflied vom Meer. Tom hört zu.', imagePromptEn: 'A glowing shell singing a lullaby, musical notes floating in a cozy room, gentle watercolor' },
    { pageNo: 3, textDe: 'Tom schließt die Augen. Er riecht Salz und Wasser. Er ist wieder am Strand.', imagePromptEn: 'A boy imagining the beach with closed eyes, the smell of salt water, dreamy watercolor scene' },
    { pageNo: 4, textDe: 'Das Meer rauscht. Die Wellen schaukeln ihn. Ganz sanft.', imagePromptEn: 'Gentle waves rocking a boy in a dream, soft blue and gold watercolor, peaceful and safe' },
    { pageNo: 5, textDe: 'Die Muschel flüstert: „Du bist mutig. Du findest immer den Weg."', imagePromptEn: 'A shell whispering to a boy in a dream, glowing softly, warm and encouraging watercolor' },
    { pageNo: 6, textDe: 'Tom lächelt. Er glaubt der Muschel. Er glaubt an sich.', imagePromptEn: 'A boy smiling with confidence, the shell glowing in his hand, warm inner light, watercolor illustration' },
    { pageNo: 7, textDe: 'Die Wellen werden leiser. Der Strand verblasst. Tom ist zuhause.', imagePromptEn: 'The beach fading into the warmth of home, a boy drifting to sleep, soft transition watercolor' },
    { pageNo: 8, textDe: 'Tom schläft. Die Muschel singt. Gute Nacht, Tom.', imagePromptEn: 'A boy sleeping soundly, a shell glowing softly beside him, moonlight, peaceful watercolor illustration' },
  ],
};

const MOCK_STORY_BOOK7_V2 = {
  bookId: 'book7',
  title: 'Clara und der singende Wind',
  pages: [
    { pageNo: 1, textDe: 'Clara liegt im Bett. Sie hört den Wind draußen. Er singt nur für sie.', imagePromptEn: 'A girl lying in bed listening to the wind outside, a gentle breeze through the curtains, soft watercolor' },
    { pageNo: 2, textDe: 'Der Wind flüstert ihren Namen. Clara lauscht. Sie lächelt.', imagePromptEn: 'The wind whispering through a curtain, a girl smiling and listening, peaceful night watercolor scene' },
    { pageNo: 3, textDe: 'Er erzählt von weiten Wiesen. Von Vögeln und Blumen. Clara ist dabei.', imagePromptEn: 'A girl dreaming of wide meadows and birds, the wind carrying her imagination, soft dreamy watercolor' },
    { pageNo: 4, textDe: 'Clara nimmt ihren Mut. Sie flüstert zurück: „Ich bin bereit."', imagePromptEn: 'A girl whispering bravely to the wind, a soft glow around her, warm and encouraging watercolor' },
    { pageNo: 5, textDe: 'Der Wind hebt sie sanft hoch. Sie fliegt. Ganz ruhig. Ganz leicht.', imagePromptEn: 'A girl floating gently on the wind, calm and light, a magical nighttime sky, soft watercolor illustration' },
    { pageNo: 6, textDe: 'Von oben sieht sie ihr Zuhause. Klein und warm. Sie fühlt sich geborgen.', imagePromptEn: 'A girl floating above her small, warm home, feeling safe and content, dreamy watercolor' },
    { pageNo: 7, textDe: 'Der Wind bringt sie zurück. Sanft wie eine Feder. Clara landet im Bett.', imagePromptEn: 'A girl floating gently back into her bed like a feather, the wind softly setting her down, watercolor' },
    { pageNo: 8, textDe: 'Clara schläft. Der Wind summt. Gute Nacht, Clara.', imagePromptEn: 'A sleeping girl with the wind humming outside, curtains swaying gently, peaceful watercolor illustration' },
  ],
};

const MOCK_STORY_BOOK8_V2 = {
  bookId: 'book8',
  title: 'Ben und das goldene Buch',
  pages: [
    { pageNo: 1, textDe: 'Ben liegt im Bett. Das Buch liegt offen. Es wartet auf ihn.', imagePromptEn: 'A boy lying in bed with an open golden book waiting for him, soft warm glow, watercolor illustration' },
    { pageNo: 2, textDe: 'Die erste Seite zeigt ihn als Baby. Ben lacht. So klein war er mal.', imagePromptEn: 'A golden book showing a baby version of a boy, the boy laughing in delight, cozy watercolor scene' },
    { pageNo: 3, textDe: 'Die nächste Seite zeigt heute. Seine Familie. Sein Zimmer. Sein Leben.', imagePromptEn: 'A golden book showing a boy\'s family and room in illustrations, warm and detailed watercolor' },
    { pageNo: 4, textDe: 'Die letzte Seite ist leer. Ben versteht. Er schreibt sie noch.', imagePromptEn: 'A boy looking at a blank last page in a golden book, realizing it\'s his future to fill, thoughtful watercolor' },
    { pageNo: 5, textDe: 'Ben nimmt einen goldenen Stift. Er malt einen Stern auf die leere Seite.', imagePromptEn: 'A boy drawing a star on a blank golden page with a magical pen, hopeful expression, soft watercolor' },
    { pageNo: 6, textDe: 'Das Buch leuchtet heller. „Genau richtig", flüstert es. Ben nickt.', imagePromptEn: 'A golden book glowing brighter, a boy nodding with satisfaction, warm magical watercolor scene' },
    { pageNo: 7, textDe: 'Ben legt das Buch weg. Er schließt die Augen. Morgen kommt eine neue Seite.', imagePromptEn: 'A boy closing his eyes with a peaceful smile, the golden book resting beside him, watercolor illustration' },
    { pageNo: 8, textDe: 'Ben schläft tief. Das Buch träumt mit ihm. Gute Nacht, Ben.', imagePromptEn: 'A boy sleeping beside a softly glowing golden book, dreamy moonlit watercolor illustration' },
  ],
};

const MOCK_STORY_BOOK9_V2 = {
  bookId: 'book9',
  title: 'Lili und der Regenbogen',
  pages: [
    { pageNo: 1, textDe: 'Lili liegt im Bett. Sie denkt an den Regenbogen. Er war so schön.', imagePromptEn: 'A girl lying in bed thinking about a rainbow, a smile on her face, soft pastel watercolor illustration' },
    { pageNo: 2, textDe: 'Sie holt den Lichttropfen aus der Tasche. Er leuchtet noch immer.', imagePromptEn: 'A girl taking a tiny glowing drop of light from her pocket, wonder in her eyes, gentle watercolor' },
    { pageNo: 3, textDe: 'Der Tropfen macht ihr Zimmer bunt. Rot, Gelb, Grün. Lili lacht.', imagePromptEn: 'A girl\'s room filled with rainbow colors from a tiny glowing drop, joyful expression, vibrant watercolor' },
    { pageNo: 4, textDe: '„Morgen wird auch schön", flüstert der Tropfen. Lili glaubt ihm.', imagePromptEn: 'A tiny glowing drop speaking to a girl, warm and reassuring light, soft hopeful watercolor' },
    { pageNo: 5, textDe: 'Sie denkt an alles, was sie liebt. Mama. Papa. Ihren Hund. Den Garten.', imagePromptEn: 'A girl thinking happily of her family, dog, and garden, warm rainbow-colored thought bubbles, watercolor' },
    { pageNo: 6, textDe: 'So viele Farben in ihrem Leben. Lili ist reich. Sie weiß es jetzt.', imagePromptEn: 'A girl surrounded by colorful lights representing her loved ones, content and grateful expression, watercolor' },
    { pageNo: 7, textDe: 'Sie legt den Tropfen vorsichtig hin. Er leuchtet sanft die ganze Nacht.', imagePromptEn: 'A girl gently placing a tiny glowing drop on her nightstand, soft rainbow light filling the room, watercolor' },
    { pageNo: 8, textDe: 'Lili schläft in Farben. Gute Nacht, Lili.', imagePromptEn: 'A girl sleeping in soft rainbow-colored light, peaceful and happy, dreamy watercolor illustration' },
  ],
};

const MOCK_STORY_BOOK10_V2 = {
  bookId: 'book10',
  title: 'Max und der schlafende Drache',
  pages: [
    { pageNo: 1, textDe: 'Max liegt im Bett. Er denkt an den Drachen. War er wirklich da?', imagePromptEn: 'A boy lying in bed thinking of a dragon, the dragon visible in his imagination, soft watercolor illustration' },
    { pageNo: 2, textDe: 'Er schaut aus dem Fenster. Der Wald ist dunkel. Irgendwo schnarcht der Drache.', imagePromptEn: 'A boy looking out his window into a dark forest, hearing a dragon snoring faintly, gentle watercolor' },
    { pageNo: 3, textDe: 'Max lächelt. Er weiß: Der Drache träumt. Vielleicht träumt er von ihm.', imagePromptEn: 'A boy smiling as he imagines the dragon dreaming of him, warm and peaceful watercolor illustration' },
    { pageNo: 4, textDe: 'Im Traum besucht Max den Drachen wieder. Er ist noch da. Er wartet.', imagePromptEn: 'A boy visiting a dragon in a dream, the dragon happily waiting, magical forest dream watercolor' },
    { pageNo: 5, textDe: 'Sie schauen zusammen in den Sternenhimmel. Kein Wort. Nur Stille.', imagePromptEn: 'A boy and a dragon sitting together looking at a starry sky, silent and content, beautiful watercolor' },
    { pageNo: 6, textDe: 'Der Drache ist anders als erwartet. Sanft. Ruhig. Wie ein großer Freund.', imagePromptEn: 'A dragon looking gentle and peaceful, a boy leaning against it, friendship visible, warm watercolor' },
    { pageNo: 7, textDe: 'Max flüstert: „Ich komme wieder." Der Drache nickt. Er schläft weiter.', imagePromptEn: 'A boy whispering to a sleeping dragon, the dragon nodding gently, moonlit forest watercolor' },
    { pageNo: 8, textDe: 'Max schläft tief. Der Drache bewacht seinen Traum. Gute Nacht, Max.', imagePromptEn: 'A boy sleeping soundly, a dragon silhouette guarding his dreams outside, peaceful watercolor illustration' },
  ],
};

// After rewrite: slightly improved text (shorter sentences, warmer tone)
const MOCK_STORY_V2 = {
  bookId: 'book1',
  title: 'Leo und die tapfere Nacht',
  pages: [
    {
      pageNo: 1,
      textDe: 'Leo liegt im Bett. Es ist dunkel. Er kann nicht schlafen.',
      imagePromptEn:
        'A small lion cub lying awake in bed at night, wide eyes, soft moonlight through curtains, watercolor illustration, cozy bedroom',
    },
    {
      pageNo: 2,
      textDe: 'Mama kommt rein. Sie lächelt sanft. „Ich habe etwas für dich."',
      imagePromptEn:
        'A gentle mama lion entering a cozy bedroom, warm smile, holding a small glowing star, soft golden light, watercolor style',
    },
    {
      pageNo: 3,
      textDe:
        'Mama gibt Leo einen Stern. Er leuchtet warm. Leo hält ihn ganz fest.',
      imagePromptEn:
        'A lion cub receiving a small glowing star from his mama, hands cupped around it, warm golden glow, peaceful expression',
    },
    {
      pageNo: 4,
      textDe: 'Schatten tanzen an der Wand. Leo schaut hin. Was ist das?',
      imagePromptEn:
        'Large friendly shadow shapes on a bedroom wall, a small lion cub looking at them curiously, soft candlelight atmosphere',
    },
    {
      pageNo: 5,
      textDe: 'Leo atmet tief. Einmal. Zweimal. „Ich bin mutig", sagt er leise.',
      imagePromptEn:
        'A brave little lion cub taking a deep breath, eyes gently closed, calm peaceful expression, soft warm light',
    },
    {
      pageNo: 6,
      textDe:
        'Die Schatten sind Freunde! Ein Hase. Ein Bär. Leo lacht fröhlich.',
      imagePromptEn:
        'Friendly shadow puppets of a rabbit and bear on a bedroom wall, a lion cub giggling with delight, cozy warm atmosphere',
    },
    {
      pageNo: 7,
      textDe:
        'Leo legt den Stern hin. Er schmiegt sich in die Decke. So warm, so schön.',
      imagePromptEn:
        'A lion cub snuggling under a blanket in bed, a small glowing star on the nightstand, content smile, cozy and safe',
    },
    {
      pageNo: 8,
      textDe:
        'Leo schläft ein. Der Stern leuchtet still. Gute Nacht, kleiner Leo.',
      imagePromptEn:
        'A sleeping lion cub in bed, a glowing star on nightstand, soft moonlight, dreamy peaceful illustration, watercolor style',
    },
  ],
};

const MOCK_QUALITY_LOW = {
  overallScore: 65,
  issues: [
    {
      category: 'language' as const,
      severity: 'high' as const,
      description:
        'Einige Sätze sind für 4-Jährige zu komplex (mehr als 10 Wörter).',
      fixSuggestion: 'Sätze auf maximal 6–8 einfache Wörter kürzen.',
    },
    {
      category: 'structure' as const,
      severity: 'medium' as const,
      description:
        'Der Spannungsbogen fehlt auf Seiten 4–5; der Übergang wirkt abrupt.',
      fixSuggestion:
        'Emotionale Eskalation sanfter gestalten, mehr Übergangsformulierungen.',
    },
    {
      category: 'tone' as const,
      severity: 'low' as const,
      description:
        'Seite 7 klingt leicht belehrend statt beruhigend.',
      fixSuggestion: 'Formulierungen wärmer und einladender gestalten.',
    },
  ],
  improvementSummary: [
    'Sätze generell kürzen und vereinfachen.',
    'Emotionalen Bogen gleichmäßiger entwickeln.',
    'Abschlussseiten wärmer und schläfrig-beruhigender formulieren.',
  ],
};

const MOCK_QUALITY_HIGH = {
  overallScore: 88,
  issues: [
    {
      category: 'repetition' as const,
      severity: 'low' as const,
      description: 'Das Wort „sanft" erscheint dreimal; leichte Variation wäre besser.',
      fixSuggestion: 'Synonyme wie „weich", „leise", „zart" einstreuen.',
    },
  ],
  improvementSummary: [
    'Sprache ist altersgerecht und klar.',
    'Spannungsbogen ist gut und beruhigend.',
    'Ton ist durchgehend warm und sicher.',
    'Safety-Kriterien vollständig erfüllt.',
  ],
};

const MOCK_MARKET_EVAL = {
  targetAudienceAnalysis: {
    primary:
      'Kinder zwischen 4 und 7 Jahren, die Einschlafprobleme oder leichte Ängste haben. Besonders wirksam für sensible und fantasievolle Kinder.',
    secondary:
      'Eltern und Betreuungspersonen, die beruhigende Abendroutinen etablieren möchten; Kindergärten und Vorschuleinrichtungen als Ergänzung zur emotionalen Bildung.',
  },
  marketPotential: {
    demand:
      'Hohe und stabile Nachfrage nach Gutenacht-Büchern mit emotionalem Mehrwert. Das Thema Angstbewältigung bei Kindern ist dauerhaft relevant und wird von Eltern aktiv gesucht.',
    competition:
      'Wettbewerbsintensiver Markt mit etablierten Titeln. Differenzierung über Ton und Illustrationsstil notwendig.',
    differentiation:
      'Die Serienstruktur mit wiederkehrenden Figuren schafft emotionale Bindung. Der beruhigende, nicht-belehrende Ton hebt die Reihe von anderen Büchern ab.',
  },
  successProbability: 4,
  improvementSuggestions: [
    'Einen wiederkehrenden Begleiter einführen, der sich durch alle Bücher zieht.',
    'Kurze Rituale am Ende jedes Buches ergänzen, die Eltern mit Kindern gemeinsam machen können.',
    'Die Zielgruppe etwas erweitern, um eine breitere Käufergruppe anzusprechen.',
    'Englische Übersetzung von Anfang an mitplanen, um internationale Märkte zu erschließen.',
  ],
};

// ─── MockLlmClient ─────────────────────────────────────────────────────────────

export interface MockLlmClientOptions {
  bookCount?: number;
  targetAge?: string;
}

export class MockLlmClient implements LlmClient {
  private qualityCallCount = 0;
  private readonly bookCount: number;
  private readonly targetAge: string;

  constructor(opts?: MockLlmClientOptions) {
    this.bookCount = Math.min(opts?.bookCount ?? 4, MOCK_PLANNER.books.length);
    this.targetAge = opts?.targetAge ?? '4-7 Jahre';
  }

  async complete(messages: LlmMessage[]): Promise<string> {
    const systemContent =
      messages.find((m) => m.role === 'system')?.content ?? '';

    // Simulate small latency so output feels realistic
    await new Promise<void>((r) => setTimeout(r, 120));

    if (systemContent.includes('##ROLE:PLANNER##')) {
      return JSON.stringify({
        ...MOCK_PLANNER,
        bookCount: this.bookCount,
        targetAge: this.targetAge,
        books: MOCK_PLANNER.books.slice(0, this.bookCount),
      });
    }

    if (systemContent.includes('##ROLE:REALITY_CHECK##')) {
      return JSON.stringify(MOCK_REALITY_CHECK);
    }

    if (systemContent.includes('##ROLE:STORY_WRITER##')) {
      const userContent = messages.find((m) => m.role === 'user')?.content ?? '';
      if (userContent.includes('book10')) return JSON.stringify(MOCK_STORY_BOOK10_V1);
      if (userContent.includes('book9'))  return JSON.stringify(MOCK_STORY_BOOK9_V1);
      if (userContent.includes('book8'))  return JSON.stringify(MOCK_STORY_BOOK8_V1);
      if (userContent.includes('book7'))  return JSON.stringify(MOCK_STORY_BOOK7_V1);
      if (userContent.includes('book6'))  return JSON.stringify(MOCK_STORY_BOOK6_V1);
      if (userContent.includes('book5'))  return JSON.stringify(MOCK_STORY_BOOK5_V1);
      if (userContent.includes('book4'))  return JSON.stringify(MOCK_STORY_BOOK4_V1);
      if (userContent.includes('book3'))  return JSON.stringify(MOCK_STORY_BOOK3_V1);
      if (userContent.includes('book2'))  return JSON.stringify(MOCK_STORY_BOOK2_V1);
      return JSON.stringify(MOCK_STORY_V1);
    }

    if (systemContent.includes('##ROLE:REWRITE_SPECIALIST##')) {
      const userContent = messages.find((m) => m.role === 'user')?.content ?? '';
      if (userContent.includes('book10')) return JSON.stringify(MOCK_STORY_BOOK10_V2);
      if (userContent.includes('book9'))  return JSON.stringify(MOCK_STORY_BOOK9_V2);
      if (userContent.includes('book8'))  return JSON.stringify(MOCK_STORY_BOOK8_V2);
      if (userContent.includes('book7'))  return JSON.stringify(MOCK_STORY_BOOK7_V2);
      if (userContent.includes('book6'))  return JSON.stringify(MOCK_STORY_BOOK6_V2);
      if (userContent.includes('book5'))  return JSON.stringify(MOCK_STORY_BOOK5_V2);
      if (userContent.includes('book4'))  return JSON.stringify(MOCK_STORY_BOOK4_V2);
      if (userContent.includes('book3'))  return JSON.stringify(MOCK_STORY_BOOK3_V2);
      if (userContent.includes('book2'))  return JSON.stringify(MOCK_STORY_BOOK2_V2);
      return JSON.stringify(MOCK_STORY_V2);
    }

    if (systemContent.includes('##ROLE:QUALITY_EVALUATOR##')) {
      this.qualityCallCount += 1;
      // First check: below target → triggers rewrite loop
      // Second+ check: above target → loop exits
      return this.qualityCallCount === 1
        ? JSON.stringify(MOCK_QUALITY_LOW)
        : JSON.stringify(MOCK_QUALITY_HIGH);
    }

    if (systemContent.includes('##ROLE:MARKET_EVALUATOR##')) {
      return JSON.stringify(MOCK_MARKET_EVAL);
    }

    throw new Error(
      `MockLlmClient: unrecognised agent role in system message.\n` +
        `System message preview: "${systemContent.slice(0, 120)}"`,
    );
  }
}
