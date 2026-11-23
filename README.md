# نظام تسويق الكتب — خط الإنتاج

خريطة النظام (دايمًا محدّثة) كـ Artifact: https://claude.ai/artifact/HkupgLx9QiQrejwuabz9KS

## الفكرة
خط إنتاج كامل من Skills متسلسلة لكل كتاب/منتج: من بحث الجمهور لحد الإعلانات المدفوعة. الجزء الأساسي (المحتوى العضوي) مبني من دراسة منهجية "التسويق بالمحتوى مقابل النشر العشوائي" (مُعاد صياغتها بدون نسخ حرفي — الكتاب المصدر محفوظ في `00-المرجعية-source-book/` للرجوع إليه فقط ولا يُسوَّق بهذا النظام).

**ترتيب التنفيذ والتفاصيل الكاملة (الهدف/القيود لكل Skill) في [ROLES.md](ROLES.md) — قسم "خطوط الإنتاج والـSkills".** ملخص سريع:

| المرحلة | Skill |
|---|---|
| هوية الكتاب | `book-brand-assigner` |
| بحث الجمهور (ICP) | `market-researcher` |
| الأوفر (بونصات) | `bonus-architect` |
| الأوفر (أبسيل/داونسيل) | `upsell-downsell-architect` |
| خطة المحتوى | `book-launch-planner` |
| كتابة البوستات | `book-launch-writer` |
| التصميم/الصور | `book-launch-visual-producer` |
| الريلز (وايت بورد) | `whiteboard-reel-producer` |
| اللاندنج بيدج | `landing-page-architect` |
| كوبي الإعلانات | `ad-copywriter` |
| كرييتيف الميديا باينج | `performance-creative-strategist` |
| المراجعة | `content-qa-reviewer` |

مثبتة محليًا في `.claude/skills/` (تشتغل تلقائيًا جوه مشروع content). التنسيق بين شاتات Team Leader/شات الكتاب/QA موضّح في [ROLES.md](ROLES.md).

## الاستخدام
في أي محادثة Claude Code جوه هذا المشروع، اكتب مثلًا:
> "عندي كتاب اسمه X بيحل مشكلة Y للجمهور Z — اعملي بحث جمهور وخطة محتوى 30 يوم له"

وهتشتغل الـ Skills المناسبة بالترتيب الموضّح في `ROLES.md`، وتحفظ كل الناتج جوه `campaigns/<اسم-الكتاب>/`.

## الداشبورد
لوحة لإدارة كل المنتجات: تختار المنتج فتلاقي كل حاجة تخصه في مكان واحد (المصدر، والهوية، والبحث، والأوفر، وخطة المحتوى يوم بيوم، والبوستات، والصور، والريلز، والإعلانات)، وحالة كل مرحلة، والصفحة بتتحدث لوحدها لما أي ملف يتغير.

```bash
cd dashboard && npm install && npm run build && npm start   # → http://localhost:5178
```

منتج جديد: `node dashboard/scripts/new-product.mjs --name "اسم الكتاب"`. التفاصيل في [dashboard/README.md](dashboard/README.md).

## هيكل المجلدات
```
pipeline.config.json                    تعريف مراحل خط الإنتاج (مصدر الداشبورد)
dashboard/                              الداشبورد (سيرفر Node + واجهة React)
.claude/skills/                         كل الـ Skills
00-المرجعية-source-book/                الكتاب المصدر (مرجعي فقط)
Brand Identity/                         نظام الهوية العام (ألوان/لوجو/قوالب)
whiteboard-video/                       محرك فيديو الوايت بورد
campaigns/<اسم-الكتاب-أو-المنتج>/
  product.json      بيانات المنتج + حالة المراحل اليدوية
  brand.md          لون الكتاب المخصص
  00-calendar/      calendar.md + calendar.csv
  01-copy/          week-N/day-N-....md
  02-visuals/       design-spec.md + صور/فيديو فعلية
  03-reels/         فيديوهات الوايت بورد
  04-research/      icp.md
  05-offer/         bonus-system.md + upsell-downsell.md
  06-landing-page/  landing-page.md
  07-ads/           ad-copies.md
  08-performance-creative/  performance-creative-machine.md
  09-results/       results.csv (الصرف والمبيعات)
  tasks.json        مهام الفريق
```
