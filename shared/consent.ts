/**
 * Consent wording, shown by the client and hashed by the server when consent is granted, so each consent record
 * proves exactly which text the person saw (the hash covers the language they read).
 *
 * DRAFT: this wording describes what the software actually does today. It has NOT had legal review and must be
 * reviewed (Jordan's Personal Data Protection Law No. 24 of 2023, COPPA / GDPR-K where relevant, and school policy)
 * before real families or schools use the service. The Arabic text was written without a native-speaker legal review.
 * Bump the version for an account type whenever any of its wording or data practices change; those users are then
 * asked again.
 */
import type { AccountType, Lang } from "./jordan";

export type ConsentText = {
  title: string;
  points: ReadonlyArray<{ heading: string; body: string }>;
  statement: string;
};

export const CONSENT_VERSIONS: Record<AccountType, string> = {
  family: "2026-10-draft-1",
  school: "2026-10-school-draft-1",
};
export const consentVersionFor = (type: AccountType) => CONSENT_VERSIONS[type];

const FAMILY_EN: ConsentText = {
  title: "Before your child uses Rated AI",
  points: [
    {
      heading: "What we collect",
      body: "Your email address, and for each child you add: a first name or nickname and an age group (not a birth date). We also store the messages your child sends, the AI's replies, homework photos they submit, and the settings you choose.",
    },
    {
      heading: "Why",
      body: "To run the learning chat and tools, to show you what your child is doing, and to create progress summaries for you. We do not sell this data and do not use it for advertising.",
    },
    {
      heading: "Who else receives it",
      body: "Messages (and homework photos) are sent to an AI service provider so it can write replies. Messages that our safety checks flag are not sent to the AI model for a reply, but may be sent to the provider's moderation service when that is switched on.",
    },
    {
      heading: "You stay in control",
      body: "You can read every conversation. Flagged messages are highlighted for you. A parent PIN protects the parent area from your child. You can export or delete a child's data, withdraw this consent, or delete your whole account at any time from the parent area.",
    },
    {
      heading: "Safety checks have limits",
      body: "Safety checks are automated and will miss some things. They are not a substitute for supervision. Please tell your child not to share surnames, addresses, phone numbers or photos.",
    },
  ],
  statement: "I am the parent or legal guardian of every child I add to Rated AI, and I agree to the above.",
};

const FAMILY_AR: ConsentText = {
  title: "قبل أن يستخدم طفلك Rated AI",
  points: [
    {
      heading: "ما الذي نجمعه",
      body: "عنوان بريدك الإلكتروني، ولكل طفل تضيفه: اسمه الأول أو لقبه وفئته العمرية (دون تاريخ الميلاد). كما نحفظ الرسائل التي يرسلها طفلك وردود الذكاء الاصطناعي وصور الواجبات التي يرفعها والإعدادات التي تختارها.",
    },
    {
      heading: "لماذا",
      body: "لتشغيل المحادثة والأدوات التعليمية، ولنُريك ما يفعله طفلك، ولإعداد ملخصات تقدّمه لك. نحن لا نبيع هذه البيانات ولا نستخدمها للإعلانات.",
    },
    {
      heading: "من يستلمها أيضاً",
      body: "تُرسَل الرسائل (وصور الواجبات) إلى مزوّد خدمة ذكاء اصطناعي ليكتب الردود. أما الرسائل التي تلتقطها فحوصات السلامة لدينا فلا تُرسَل إلى نموذج الذكاء الاصطناعي للرد عليها، لكنها قد تُرسَل إلى خدمة الإشراف لدى المزوّد عند تفعيلها.",
    },
    {
      heading: "أنت صاحب القرار",
      body: "يمكنك قراءة كل المحادثات، وتُبرَز لك الرسائل التي التقطتها فحوصات السلامة. يحمي رمز PIN الخاص بولي الأمر منطقة أولياء الأمور من طفلك. ويمكنك في أي وقت تصدير بيانات الطفل أو حذفها، أو سحب هذه الموافقة، أو حذف حسابك بالكامل من منطقة أولياء الأمور.",
    },
    {
      heading: "لفحوصات السلامة حدود",
      body: "فحوصات السلامة آلية وستفوتها بعض الأمور، وهي ليست بديلاً عن الإشراف. من فضلك أخبر طفلك ألا يشارك اسم العائلة أو العنوان أو أرقام الهاتف أو الصور.",
    },
  ],
  statement: "أنا والد/ولي أمر كل طفل أضيفه إلى Rated AI، وأوافق على ما سبق.",
};

const SCHOOL_EN: ConsentText = {
  title: "Before your class uses Rated AI",
  points: [
    {
      heading: "What we collect",
      body: "Your email address, and for each student you add: a first name or nickname (we recommend not using full names), their class and grade. We also store the messages students send, the AI's replies, homework photos they submit, game scores and mood check-ins.",
    },
    {
      heading: "Why",
      body: "To let students practise with games and ask questions, to show you your class's progress, and to let you assign activities. We do not sell this data and do not use it for advertising.",
    },
    {
      heading: "Who else receives it",
      body: "Messages (and homework photos) are sent to an AI service provider so it can write replies. Messages that our safety checks flag are not sent to the AI model for a reply, but may be sent to the provider's moderation service when that is switched on.",
    },
    {
      heading: "The school's responsibility",
      body: "By agreeing, the school confirms that it is authorised to use Rated AI with these students and has obtained any consent from parents or guardians that the law and the school's own policies require. Rated AI does not collect that consent for the school.",
    },
    {
      heading: "What teachers can see",
      body: "Teachers see the progress, game results, flagged messages and mood notes of their own students. A teacher PIN protects the teacher area from students on a shared device. You can export or delete a student's data, withdraw this consent, or delete the account at any time.",
    },
    {
      heading: "Safety checks have limits",
      body: "Safety checks are automated and will miss some things. They are not a substitute for supervision. Please tell students not to share surnames, addresses, phone numbers or photos.",
    },
  ],
  statement:
    "I am a teacher or school staff member authorised to use Rated AI with these students, and the school has obtained any parental consent that is required.",
};

const SCHOOL_AR: ConsentText = {
  title: "قبل أن يستخدم صفّك Rated AI",
  points: [
    {
      heading: "ما الذي نجمعه",
      body: "عنوان بريدك الإلكتروني، ولكل طالب تضيفه: اسمه الأول أو لقبه (ننصح بعدم استخدام الأسماء الكاملة) وصفّه ومستواه الدراسي. كما نحفظ الرسائل التي يرسلها الطلاب وردود الذكاء الاصطناعي وصور الواجبات التي يرفعونها ونتائج الألعاب وتسجيلات المشاعر.",
    },
    {
      heading: "لماذا",
      body: "ليتدرّب الطلاب بالألعاب ويطرحوا أسئلتهم، ولنُريك تقدّم صفّك، ولتتمكن من تكليف الطلاب بأنشطة. نحن لا نبيع هذه البيانات ولا نستخدمها للإعلانات.",
    },
    {
      heading: "من يستلمها أيضاً",
      body: "تُرسَل الرسائل (وصور الواجبات) إلى مزوّد خدمة ذكاء اصطناعي ليكتب الردود. أما الرسائل التي تلتقطها فحوصات السلامة لدينا فلا تُرسَل إلى نموذج الذكاء الاصطناعي للرد عليها، لكنها قد تُرسَل إلى خدمة الإشراف لدى المزوّد عند تفعيلها.",
    },
    {
      heading: "مسؤولية المدرسة",
      body: "بالموافقة، تؤكد المدرسة أنها مخوّلة باستخدام Rated AI مع هؤلاء الطلاب، وأنها حصلت على أي موافقة من أولياء الأمور يتطلبها القانون وسياسات المدرسة. لا يقوم Rated AI بجمع هذه الموافقة نيابةً عن المدرسة.",
    },
    {
      heading: "ما يراه المعلّمون",
      body: "يرى المعلّمون تقدّم طلابهم ونتائج الألعاب والرسائل التي التقطتها فحوصات السلامة وملاحظات المشاعر. ويحمي رمز PIN الخاص بالمعلّم منطقة المعلّم من الطلاب على الجهاز المشترك. ويمكنك في أي وقت تصدير بيانات طالب أو حذفها، أو سحب هذه الموافقة، أو حذف الحساب.",
    },
    {
      heading: "لفحوصات السلامة حدود",
      body: "فحوصات السلامة آلية وستفوتها بعض الأمور، وهي ليست بديلاً عن الإشراف. من فضلك أخبر الطلاب ألا يشاركوا اسم العائلة أو العنوان أو أرقام الهاتف أو الصور.",
    },
  ],
  statement: "أنا معلّم/موظف في المدرسة ومخوّل باستخدام Rated AI مع هؤلاء الطلاب، وقد حصلت المدرسة على أي موافقة مطلوبة من أولياء الأمور.",
};

export const CONSENT: Record<AccountType, Record<Lang, ConsentText>> = {
  family: { en: FAMILY_EN, ar: FAMILY_AR },
  school: { en: SCHOOL_EN, ar: SCHOOL_AR },
};

export const consentFor = (type: AccountType, lang: Lang): ConsentText => CONSENT[type][lang];

// Backward-compatible names for the English family wording.
export const CONSENT_VERSION = CONSENT_VERSIONS.family;
export const CONSENT_TITLE = FAMILY_EN.title;
export const CONSENT_POINTS = FAMILY_EN.points;
export const CONSENT_STATEMENT = FAMILY_EN.statement;
