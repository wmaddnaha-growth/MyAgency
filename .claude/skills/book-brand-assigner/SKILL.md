---
name: book-brand-assigner
description: Assign a book/product its signature brand color and link it to the shared brand system (logo, fonts, templates) before any content work starts. Use this skill whenever a new book/product is being onboarded into the project and has no `brand.md` yet, or when a book's brand assignment needs to be looked up or re-checked.
---

# Book Brand Assigner

دورك: تخصيص هوية بصرية متّسقة مع النظام العام لكل كتاب/منتج جديد، بدون تكرار نفس اللون بين كتابين.

## الخطوة 1: اقرا النظام العام

اقرأ `Brand Identity/03-foundations/tokens.json` — فيه:
- `color.master.teal` — لون الماستر براند (شعار الصفحة نفسها، مش لكتاب معين).
- `color.product.*` — قايمة الألوان المتاحة لتخصيص كتاب (`maroon`, `navy`, `petrol`, `rust`, `forest`, `plum`, `umber`, `olive`, `slate`).
- `font.*`, `space.*`, `radius.*`, `shadow.*` — عناصر الهوية المشتركة بين كل الكتب بدون تغيير (الخط والمسافات والشكل العام ثابتين، الفرق بس في اللون).

## الخطوة 2: شوف الألوان المستخدمة فعلاً

افتح كل `campaigns/<كتاب>/brand.md` الموجود حاليًا، وسجّل أي لون من `color.product` مُستخدم already. لا تكرر لون لكتاب جديد إلا لو خلصت كل الألوان العشرة (في هذه الحالة أخبر المستخدم إن الـpalette خلصت واسأله يوسّعها أو يعيد استخدام لون).

## الخطوة 3: رشّح لون للكتاب الجديد

اختر أقرب لون غير مستخدم لموضوع/مزاج الكتاب (مثلاً `maroon`/`rust` لموضوع حماسي أو جنسي، `navy`/`petrol`/`slate` لموضوع هادئ تحليلي، `forest`/`olive` لموضوع نمو شخصي)، واعرضه على المستخدم في سطر واحد للموافقة قبل الحفظ لو كان قرار Team Leader يحتاج تأكيد، أو احفظه مباشرة لو السياق واضح إن القرار آلي بالكامل.

## الخطوة 4: احفظ `brand.md`

أنشئ/حدّث `campaigns/<اسم الكتاب>/brand.md` بالصيغة:

```markdown
# هوية الكتاب: <اسم الكتاب>

- **اللون المخصص**: <اسم اللون> — `<hex>`
- **المصدر**: `Brand Identity/03-foundations/tokens.json` → `color.product.<اسم اللون>`
- **الخطوط**: كما في النظام العام (`font.display`, `font.body-book`, `font.ui`) — بدون تخصيص إضافي إلا لو طلب المستخدم.
- **قوالب الاستخدام**:
  - غلاف/صفحات الكتاب: `Brand Identity/06-product-identity/`
  - قوالب سوشيال: `Brand Identity/07-social-templates/`
  - اللوجو: `Brand Identity/05-logo-system/` (النسخة اللي تناسب اللون/الخلفية)
- **ملاحظات بصرية خاصة بالكتاب** (لو فيه): <أي تفصيلة بسيطة إضافية طلبها المستخدم>
```

## الخطوة 5: أبلغ

اذكر للمستخدم أو لـTeam Leader: اللون المخصص، ومكان حفظ `brand.md`، وإن أي skill تاني (planner/writer/visual-producer/QA) لازم يقرا الملف ده قبل إنتاج أي محتوى بصري لهذا الكتاب.
