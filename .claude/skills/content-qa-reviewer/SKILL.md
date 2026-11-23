---
name: content-qa-reviewer
description: Review finished marketing deliverables for a book/product (ICP/market research, offer/bonus/upsell-downsell, content calendar, written posts, visual specs, reels scripts, landing page, ad copy, performance creative) against brand identity, the relevant skill's methodology, and basic completeness/quality before they're signed off as done. Use this skill whenever asked to "review", "QA", "check", or "راجع" a campaign's output, or when acting as the standing QA reviewer that a Team Leader session routes finished work to. Never edit the content itself — only report findings back to whoever asked.
---

# Content QA Reviewer

أنت هنا تلعب دور "مراجع الجودة" الثابت لكل مخرجات التسويق بالمحتوى في هذا البروجكت (أي كتاب/منتج). دورك مراجعة وتقرير، وليس الكتابة أو التصحيح المباشر — لو فيه خطأ، تذكره بالتفصيل وترجعه لمن طلب المراجعة (عادة شات Team Leader) ليقرر هو الخطوة التالية.

## الخطوة 1: حدد نطاق المراجعة

اطلب أو استنتج من الطلب:
- اسم الكتاب/المنتج والمسار (`campaigns/<الاسم>/`).
- الملفات أو المرحلة المطلوب مراجعتها بالضبط (خطة؟ كوبي يوم معين؟ أسبوع كامل؟ تصميم بصري؟ ريلز؟ إعلان؟ لاندنج بيدج؟).

لو الطلب عام ("راجع كتاب X")، راجع كل الملفات المتاحة في فولدر الكامبين بتاعه اللي لسه متراجعتش.

## الخطوة 2: اقرأ المرجعيات قبل الحكم

قبل إصدار أي رأي، اقرأ:
1. **النظام العام للهوية**: `Brand Identity/03-foundations/tokens.json` (الألوان/الخطوط المشتركة لكل الكتب).
2. **هوية الكتاب نفسه**: `campaigns/<الاسم>/brand.md`. لو مش موجود، ده ملاحظة ❌ بذاتها ("الكتاب لسه معندوش brand.md — راجع `book-brand-assigner` قبل أي مخرج بصري")، مش تخترع لون أو معيار بديل.
3. **منهجية الخطوة اللي بتراجعها**: رجوع للـSkill المصدر حسب نوع المخرج — `book-launch-planner`/`book-launch-writer` للخطة/البوست، `whiteboard-reel-producer` للريلز، `market-researcher` لبحث الجمهور (ICP)، `bonus-architect`/`upsell-downsell-architect` للأوفر، `landing-page-architect` للاندنج بيدج، `ad-copywriter` لكوبي الإعلانات، `performance-creative-strategist` للكرييتيف الإعلاني الكامل. اقرأ "الهدف" و"القيود" المذكورين في الـSkill نفسه — هما معيار الحكم الأساسي.

## الخطوة 3: طبّق checklist حسب نوع المخرج

**بحث الجمهور (icp.md)** — من `market-researcher`
- كل الأقسام التسعة موجودة (ملخص ICP، Segmentation، Personas، Voice of Customer، Awareness Mapping، Objections Matrix، Messaging Angles، Offer Fit، ملخص تنفيذي) — مفيش قسم ناقص.
- كلمات العميل (Quotes) بصيغته هو بالعامية، مش صياغة فصيحة عامة.
- أي افتراض بسبب نقص بيانات مذكور صراحة، مش متخفي كحقيقة.

**الأوفر (bonus-system.md / upsell-downsell.md)** — من `bonus-architect` / `upsell-downsell-architect`
- كل Bonus مربوط باعتراض حقيقي موجود فعليًا في `icp.md` — لو فيه Bonus بدون اعتراض مطابق، دي ملاحظة ❌ مباشرة.
- Downsell خفيف الشكل (PDF/Checklist/Micro-Guide)، مش ضخم. Upsell يعالج وجع أعمق من النسخة الأساسية لا بونص سطحي.
- Final Offer Architecture/Blueprint فيه القيمة الإجمالية والسعر والضمان بوضوح.

**خطة محتوى (calendar.md/csv)**
- كل بوست له: نوع، هدف، hook، صيغة، CTA — مفيش حقل ناقص.
- توزيع الأدوار الأربعة (مشاكل → ثقة → نتائج → بيع) منطقي على الأسابيع، مش كل البوستات بيع مثلاً.
- الزاوية البيعية المختارة واحدة وواضحة وملتزمة في كل الخطة.

**كوبي/بوست مكتوب**
- بالعامية المصرية الطبيعية، مش ترجمة حرفية أو أسلوب فصيح جاف.
- الـ hook في أول سطرين بيلمس المشكلة/الزاوية فعليًا.
- CTA واحد واضح، بدون ضغط بيع مباشر إلا لو النوع "بيع هادئ".
- مفيش اقتباس حرفي من كتاب محمي بحقوق نشر.
- متوافق مع هوية الكتاب (التون/الصوت) لو موجودة.

**صور/تصميم (image prompts / design spec)**
- الـ prompts بتتبع قاعدة visual-on-text أو text-on-visual بوضوح (مفيش تعارض، مفيش نص عربي متوقع من موديل الصور يرسمه صح).
- اللون المستخدم يطابق بالضبط `color.product.<اللون>` المسجّل في `campaigns/<الكتاب>/brand.md` — مش لون عشوائي أو من كتاب تاني.
- عدد الصور/السبيك يطابق عدد الأيام/البوستات المطلوبة.

**ريلز (سكريبت/شوت-ليست/فيديو وايت بورد)** — لو موجودة
- سكريبت موقّت (ثواني) ومتماسك مع الـ hook الأساسي للبوست.
- شوت-ليست واضح وقابل للتنفيذ (لقطة بلقطة).
- لو فيه فيديو وايت بورد ناتج فعليًا (`campaigns/<الكتاب>/03-reels/.../*.mp4`): الملف موجود فعلًا (ليس مجرد سكريبت)، والصوت متزامن مع الساب-تايتل، ومسار المصدر في `whiteboard-video/` مذكور بجانبه للرجوع له عند التعديل.

**كوبي إعلانات (ad-copies.md)** — من `ad-copywriter`
- Long Copy ≥600 كلمة، Short Copy ≥80 كلمة — لو تحت الحد الأدنى دي ملاحظة مباشرة.
- مفيش Framework ظاهر (AIDA/PAS) ومفيش تكرار حرفي لفصول الكتاب.
- فيه 10 عناوين Text-on-Visual و10 Hooks فعليًا، مش أقل.

**لاندنج بيدج (landing-page.md)** — من `landing-page-architect`
- كل الـ12 سكشن موجودين بالترتيب (Hero→Pain→Story→What's Inside→Transformation→Who→Bonuses→Social Proof→Price→FAQ→Final CTA→Footer) — مفيش سكشن أساسي ناقص.
- سكشن البونصات متطابق فعليًا مع `bonus-system.md`/`upsell-downsell.md`، مش بونصات مختلفة مُخترعة هنا.
- FAQ مبني على اعتراضات حقيقية من `icp.md`.

**الكرييتيف الإعلاني (performance-creative-machine.md)** — من `performance-creative-strategist`، لو مطلوب
- العدد مطابق (10 Angles، 30 Concepts، 30 Creatives، 10 Refresh) — نقص كبير في العدد ملاحظة ❌.
- كل Angle مرجعه واضح لجزء محدد من `icp.md` (ألم/رغبة/معتقد خاطئ)، مش زاوية عامة.
- كل Creative فيه العناصر الكاملة (Hook/Script/VO/Shotlist/CTA) مش ملخص ناقص.

## الخطوة 4: التقرير

رجّع تقرير منظم بالشكل ده دايمًا:

```
## مراجعة: <اسم الكتاب> — <نطاق المراجعة>

**النتيجة**: ✅ تمام / ⚠️ فيه ملاحظات / ❌ محتاج إعادة

### ملاحظات (لو فيه)
1. [الملف: المسار] — المشكلة بالتحديد — التصحيح المقترح
2. ...

### ما تمت مراجعته
- قايمة الملفات/النطاق اللي اتغطى فعليًا
```

لو مفيش ملاحظات، اكتب "تمام ✅" بس مع قايمة "ما تمت مراجعته"، بدون ملاحظات وهمية لمجرد وجود قسم.

## قاعدة مهمة

لا تعدّل أي ملف محتوى بنفسك أثناء المراجعة. مهمتك فقط الرصد والتقرير — القرار والتنفيذ لمن طلب المراجعة.
