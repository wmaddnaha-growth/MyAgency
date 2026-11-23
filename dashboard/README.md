# الداشبورد — لوحة إدارة المنتجات

## التشغيل
```bash
cd dashboard
npm install        # أول مرة بس
npm run build      # بعد أي تعديل في web/src
npm start          # → http://localhost:5178
```
للتطوير: `npm run dev` (Vite على 5179 مع hot reload، والـ API على 5178).

## الفكرة
- **مفيش database.** السيرفر (`server/index.mjs`، Node بدون مكتبات) بيقرا `campaigns/` و `Books/` مباشرة كل مرة، وبيبعت تحديث لايف (SSE) لما أي ملف يتغير. يعني أي حاجة Claude أو الـ Skills يحفظوها تظهر لوحدها.
- **مفيش أسماء كتب في الكود.** أي فولدر في `campaigns/` بيظهر كمنتج، ولو مفيش `product.json` البيانات بتتستنتج من اسم الفولدر.
- **المراحل من `pipeline.config.json`** في روت البروجكت. أي مرحلة أو Skill أو نوع منتج جديد يتضاف هناك.

## عقد المنتج — `campaigns/<slug>/product.json`
```json
{
  "slug": "شفرة-الرجالة",
  "name": "شفرة الرجالة",
  "type": "ebook",
  "status": "active",
  "series": "الشفرة",
  "source": "Books/2- شفرة الرجالة",
  "mainFile": "Books/2- شفرة الرجالة/كتاب شفرة الرجالة.pdf",
  "created": "2026-11-23",
  "notes": "",
  "stages": { "research": { "status": "review", "note": "...", "updatedAt": "2026-11-23" } }
}
```
- `type`: مفتاح من `productTypes` في `pipeline.config.json`.
- `status`: `planned` | `active` | `paused` | `archived`.
- `stages.<id>.status` (يدوي، اختياري): `in-progress` | `review` | `approved` | `needs-fix` | `rejected` | `skipped`.
  - الحالة اليدوية بتغلب على التلقائية.
  - الحالة التلقائية بتتحسب من الملفات: `missing` (لسه)، `partial` (فيه ملفات بس الناتج القياسي ناقص)، `done` (موجود)، `blocked` (مستني مرحلة قبله).

## منتج جديد
```bash
node dashboard/scripts/new-product.mjs --name "اسم الكتاب" --series "السلسلة"
node dashboard/scripts/new-product.mjs --scan    # يسجّل أي فولدر في campaigns/ أو Books/ ملوش product.json
```

## أنواع المراحل في `pipeline.config.json`
- `single`: ملف ناتج واحد أو أكتر (`outputs`). موجود لما كلهم يكونوا موجودين.
- `perDay`: بيتربط بأيام `00-calendar/calendar.csv`، وملفاته فيها `day-<N>` في الاسم. `match: "file"` للبوستات، و`"folder"` لفولدرات التصاميم.
- `collection`: فولدرات عناصر (زي الريلز). موجودة لما يبقى فيها ميديا.

## الملفات
- `lib/core.mjs`: اكتشاف المنتجات، وحساب حالة المراحل، وربط الأيام، والبحث.
- `server/index.mjs`: الـ API (`/api/products`، و`/api/products/:slug`، و`/api/file`، و`/api/search`، و`/api/events`).
- `web/src/`: الواجهة.
  - `Home.tsx`: كروت أو مصفوفة كل المنتجات.
  - `Product.tsx`: صفحة المنتج بمراحله.
  - `ui.tsx`: عارض الملفات.
