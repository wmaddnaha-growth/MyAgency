---
name: book-brand-assigner
description: Assign a book/product its signature brand color and link it to the shared brand system (logo, fonts, templates) before any content work starts. Use this skill whenever a new book/product is being onboarded into the project and has no `brand.md` yet, or when a book's brand assignment needs to be looked up or re-checked.
---

# Book Brand Assigner

دورك: تخصيص هوية بصرية متّسقة مع النظام العام لكل كتاب/منتج جديد. **كتب السلسلة الواحدة بتشترك في نفس اللون** (عشان القارئ يعرف إنها سلسلة واحدة)، وأي سلسلة أو كتاب منفرد ليه لون مش متكرر مع أي سلسلة/كتاب تاني.

## الخطوة 1: اقرا النظام العام

اقرأ `Brand Identity/03-foundations/tokens.json` — فيه:
- `color.master.teal` — لون الماستر براند (شعار الصفحة نفسها، مش لكتاب معين).
- `color.product.*` — قايمة الألوان المتاحة لتخصيص كتاب (`maroon`, `navy`, `petrol`, `rust`, `forest`, `plum`, `umber`, `olive`, `slate`).
- `font.*`, `space.*`, `radius.*`, `shadow.*` — عناصر الهوية المشتركة بين كل الكتب بدون تغيير (الخط والمسافات والشكل العام ثابتين، الفرق بس في اللون).

## الخطوة 2: شوف السلسلة والألوان المستخدمة فعلاً

1. **السلسلة**: اقرا `campaigns/<الكتاب>/product.json` → `series`. لو فيه سلسلة، دوّر على أي كتاب تاني ليه نفس `series` في `campaigns/*/product.json` وعنده `brand.md` — **لو لقيت، استخدم نفس لونه بالظبط** (نفس `color.product.<اللون>`) واكتب في ملاحظات `brand.md` إن اللون ده لون السلسلة واذكر كتبها. متعملش الخطوة 3.
   - لو كتب السلسلة الموجودة عندها ألوان مختلفة عن بعض (تخصيص قديم قبل القاعدة دي)، متختارش لوحدك: اذكر التعارض واقترح لون السلسلة الأقدم.
2. **باقي الألوان**: افتح كل `campaigns/<كتاب>/brand.md` الموجود، وسجّل الألوان المستخدمة **لكل سلسلة/كتاب منفرد**. اللون المستخدم لسلسلة تانية أو لكتاب منفرد ممنوع يتكرر. لو خلصت الألوان العشرة، أخبر المستخدم إن الـpalette خلصت واسأله يوسّعها أو يعيد استخدام لون.

## الخطوة 3: رشّح لون للكتاب الجديد

(لكتاب منفرد، أو أول كتاب في سلسلة جديدة) اختر أقرب لون غير مستخدم لموضوع/مزاج الكتاب/السلسلة (مثلاً `maroon`/`rust` لموضوع حماسي أو جنسي، `navy`/`petrol`/`slate` لموضوع هادئ تحليلي، `forest`/`olive` لموضوع نمو شخصي)، واعرضه على المستخدم في سطر واحد للموافقة قبل الحفظ لو كان قرار Team Leader يحتاج تأكيد، أو احفظه مباشرة لو السياق واضح إن القرار آلي بالكامل.

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
- **السلسلة** (لو فيه): <اسم السلسلة> — اللون مشترك مع: <الكتب التانية في السلسلة>
- **ملاحظات بصرية خاصة بالكتاب** (لو فيه): <أي تفصيلة بسيطة إضافية طلبها المستخدم>
```

## الخطوة 5: أبلغ

اذكر للمستخدم أو لـTeam Leader: اللون المخصص، ومكان حفظ `brand.md`، وإن أي skill تاني (planner/writer/visual-producer/QA) لازم يقرا الملف ده قبل إنتاج أي محتوى بصري لهذا الكتاب.
