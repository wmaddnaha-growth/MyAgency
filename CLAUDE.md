# بروجكت: تسويق الكتب الإلكترونية

اقرأ قبل أي شغل في هذا البروجكت:
1. `README.md` — خط إنتاج الكونتنت ماركتنج (الـ 3 Skills: planner → writer → visual-producer) وهيكل فولدرات `campaigns/`.
2. `ROLES.md` — بروتوكول التنسيق بين الشاتات الثابتة (Team Leader / شات كل كتاب / QA)، لو أنت واحد من الشاتات دي.

## القواعد الثابتة
- أي كتاب جديد له فولدر مصدر تحت `Books/<اسم الكتاب>/` وفولدر كامبين تحت `campaigns/<اسم الكتاب>/`.
- الكتاب المصدر المرجعي للمنهجية نفسها (`00-المرجعية-source-book/`) مرجعي فقط ولا يُسوَّق ولا يُقتبس منه حرفيًا.
- نظام الهوية العام (ألوان/خطوط/لوجو/قوالب) في `Brand Identity/` — ثابت ولا يتغير لكل كتاب. هوية كل كتاب (لون واحد مخصص من `Brand Identity/03-foundations/tokens.json` → `color.product.*`، بدون تكرار بين كتابين) تُحفظ في `campaigns/<اسم الكتاب>/brand.md` عبر Skill `book-brand-assigner`.
- فيديو الوايت بورد (`whiteboard-video/`) أداة إنتاج مبدأية بالكود — أي فيديو جديد عبر Skill `whiteboard-reel-producer`، والناتج يُسلَّم في `campaigns/<اسم الكتاب>/03-reels/`.
- بحث الجمهور (ICP) + منظومة الأوفر (بونصات/أبسيل-داونسيل) + اللاندنج بيدج + كوبي الإعلانات + الكرييتيف الإعلاني الكامل — كل واحد Skill مستقل (`market-researcher`, `bonus-architect`, `upsell-downsell-architect`, `landing-page-architect`, `ad-copywriter`, `performance-creative-strategist`)، تفاصيل الترتيب والهدف والقيود لكل واحد في `ROLES.md` قسم "خطوط الإنتاج والـSkills".
- **كل منتج له `campaigns/<slug>/product.json`** (الاسم، النوع، الحالة، السلسلة، مسار المصدر في `Books/`، الملف الأساسي، وحالة المراحل اليدوية تحت `stages`). أي منتج جديد يتسجل بـ `node dashboard/scripts/new-product.mjs --name "<الاسم>"` (أو `--scan` لتسجيل أي فولدر موجود). النظام لكل منتجات B2C الحالية والجاية، مش مربوط بكتب معينة.
- **مراحل خط الإنتاج معرّفة في `pipeline.config.json`** (المرحلة ← الـSkill ← مسارات الناتج ← الاعتماديات). أي Skill/مرحلة/نوع منتج جديد يتضاف هناك، والداشبورد بيتظبط لوحده.
- **لما تخلص أو تراجع مرحلة**، حدّث `stages.<id>` في `product.json` (مثلاً `{"status": "review", "note": "...", "updatedAt": "YYYY-MM-DD"}`). القيم: `in-progress`, `review`, `approved`, `needs-fix`, `rejected`, `skipped`. الحالات التلقائية (موجود/ناقص/لسه) بتتحسب من الملفات، فمتكتبهاش.
- الداشبورد (`dashboard/`) أداة كود تقني زي `whiteboard-video/` — تشغيله: `cd dashboard && npm start` ← http://localhost:5178. بيقرا الملفات مباشرة، فمفيش أي خطوة إضافية بعد ما تحفظ أي ملف في مكانه الصح.
- لا تُنشأ ملفات محتوى فعلية خارج `campaigns/<اسم الكتاب>/` (أو فولدراته الفرعية 00-calendar/01-copy/02-visuals/03-reels/04-research/05-offer/06-landing-page/07-ads/08-performance-creative)، أو خارج `whiteboard-video/` و `dashboard/` للكود التقني نفسه.
