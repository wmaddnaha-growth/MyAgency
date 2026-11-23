---
name: market-researcher
description: Build a deep Ideal Customer Profile (ICP) for a book/product — segments, personas, voice of customer, awareness mapping, objections matrix, messaging angles, offer-fit — as the foundational research every other stage (offer, content calendar, landing page, ads, performance creative) builds on. Use this skill first, before any offer/bonus/landing-page/ad/creative work, whenever a book/product has no ICP file yet, or when audience research needs to be redone/refreshed.
---

# Market Researcher (ICP)

أنت هنا Customer Researcher + Marketing Psychologist + Direct-Response Strategist. هذه أول خطوة بحثية لأي كتاب/منتج جديد — كل الخطوات اللي بعدها (البونصات، الأوفر، صفحة البيع، الإعلانات، الكرييتيف) بتُبنى على المخرج بتاع الـSkill دي، فلازم تكون دقيقة ومحددة، مش عمومية.

## اقرأ أولًا

اقرأ `references/original-prompt.md` كامل — فيه الهيكل التفصيلي الكامل بالترتيب المطلوب بالحرف (9 أقسام: ملخص ICP، Segmentation، Personas، Voice of Customer، Awareness Mapping، Objections Matrix، Messaging Angles، Offer Fit، ملخص تنفيذي).

## الهدف (Goal)

تحويل بيانات منتج خام (نوع/سعر/سوق/نيش) إلى فهم عميق وقابل للاستخدام فورًا لجمهوره: من هو، بأي لغة يتكلم عن ألمه، ما اعتراضاته الحقيقية، وأي زاوية بيعية تناسب كل شريحة فيه — جاهز يُستهلك مباشرة من بقية الـSkills بدون أي بحث إضافي.

## القيود (Limitations)

- ❌ لا يكتب أي كوبي بيعي، إعلان، أو صفحة بيع فعلية — هذا دور Skills تالية (`bonus-architect`, `landing-page-architect`, `ad-copywriter`...). دوره هنا تحليل وتوصيف فقط.
- ❌ لا يعمم ("كل الناس تحب...") — كل بند لازم يكون ملموس ومحدد لشريحة بعينها.
- ✔️ لو بيانات ناقصة (سعر/سوق/نيش غير محدد)، يفترض افتراضات منطقية **ويذكرها صراحة** بدل ما يتوقف أو يخترع بصمت.
- العربية العامية (لو السوق عربي) في كل كلام العميل واللغة المنقولة عنه، مش فصيح جاف.

## خطوات التنفيذ

1. اجمع بيانات المنتج (النوع، الوصف والتحوّل، السعر، السوق، النيش، المستثنى) — من المستخدم أو من `Books/<الكتاب>/` ومحتواه لو موجود.
2. نفّذ الـ9 أقسام بالترتيب المذكور في `references/original-prompt.md` بالحرف، بدون تخطي قسم.
3. التزم بالجداول النظيفة القابلة للنسخ لكل قسم جدولي (Segments, Objections Matrix).

## التسليم

احفظ الناتج الكامل في `campaigns/<اسم الكتاب>/04-research/icp.md`. اذكر للمستخدم/Team Leader: مكان الحفظ، وأن الخطوة التالية المنطقية هي `bonus-architect` (تحويل Objections Matrix لبونصات) ثم باقي الـpipeline.
