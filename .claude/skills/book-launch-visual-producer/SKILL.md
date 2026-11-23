---
name: book-launch-visual-producer
description: Turn one finished piece of copy (caption or video script) for a book/product/service launch into a full production package — Canva-ready slide/layout spec, text-free AI image-generation prompts (with actual sample images generated), a reel shot list, a voice-over script, and CapCut edit notes. Use this skill whenever the user has finished copy from book-launch-writer and asks for visuals, images, a reel/video plan, design, or "turn this into content I can actually post" — it is step 3 of the planner → writer → visual-producer pipeline.
---

# Book Launch Visual Producer

دورك: تاخد نص جاهز (من `book-launch-writer`) وتحوّله لحزمة إخراج كاملة جاهزة للتنفيذ — تصميم + صور حقيقية مولّدة بالـ AI + خطة تصوير ريلز + سكربت صوت + ملاحظات مونتاج.

اقرأ `references/visual-guidelines.md` أولًا.

## 1. مواصفة التصميم (Canva-ready)

لكل بوست/كاروسيل حدد:
- عدد السلايدز ومحتوى كل سلايد (مثال: سلايد 1 = Hook، سلايد 2-3 = المشكلة/الحل، سلايد أخير = CTA)
- اللونين الأساسيين المستخدمين
- نوع الخط المقترح (واضح وقابل للقراءة على الموبايل)
- أي عنصر بصري أساسي لكل سلايد (أيقونة/صورة/رقم بارز)

## 2. توليد صور حقيقية بالذكاء الاصطناعي

لكل بوست، صورة الغلاف الرئيسية (الأولى) تُبنى بأسلوب "scroll-stopper": نص عربي بارز من الـ Hook مرسوم فعليًا داخل الصورة فوق خلفية واقعية مرتبطة بالمشكلة — استخدم نموذج `gpt-image-2` تحديدًا (أثبت دقة عالية في رسم النص العربي لما تُعطيه الجملة بين علامتي تنصيص مع "EXACT TEXT ... verbatim"، التفاصيل في `references/visual-guidelines.md`). باقي الصور المساندة تُبنى نص-فري حسب نفس الملف.

**استخدم أداة `creative_generate_image`** لتوليد نموذج حقيقي فعليًا (لا تكرر التوليد لنفس الفكرة أكثر من مرة واحدة — كل استدعاء يستهلك رصيد المستخدم). بعد التوليد، راجع النص المرسوم بالعين (استخدم `creative_get_generations` لعرض الصور) قبل اعتماد أي صورة.
- لو المستخدم طلب فيديو قصير كعيّنة، استخدم `creative_generate_video` بعد تجهيز البرومبت، واذكر له قبل التنفيذ أن الفيديو أبطأ/أغلى من الصورة الثابتة.
- لو النموذج يحتاج يبني على صورة سابقة (مثلًا تعديل صورة منتج حقيقي أرسله المستخدم)، استخدم `creative_attach_reference_file` أو `creative_upload_flow_reference` ثم مرّر `connect_from` لـ `creative_edit_image`.
- أنشئ الأصول كلها على نفس `flow_id` الخاص بالحملة (أنشئه مرة واحدة بـ `creative_create_flow` في أول استخدام للحملة، واستخدمه لكل الأصول التالية) لتبقى منظمة في مكان واحد قابل للمراجعة.
- لا تستخدم هذه الأداة لتوليد عشرات الصور دفعة واحدة بدون مراجعة المستخدم — ابدأ بعيّنة (1-3 صور) لكل بوست رئيسي، واسأله لو احتاج المزيد.

## 3. خطة تصوير الريلز (Shot List)

لو البوست ريلز/فيديو، فصّل لكل مشهد: الزمن التقريبي، الكادر/الزاوية، الفعل المطلوب تصويره، والنص الظاهر على الشاشة (caption).

## 4. سكربت الصوت

حوّل نص `book-launch-writer` لصيغة "كلام منطوق" بفواصل طبيعية — جاهز للتسجيل المباشر أو لاستخدام `creative_generate_speech` لو المستخدم طلب صوت AI (اختر صوتًا من `creative_list_voices` ولا تخترعه من الذاكرة).

## 5. ملاحظات مونتاج CapCut

قائمة مختصرة: ترتيب المشاهد، مدة كل مشهد، أي انتقال بسيط، ومكان ظهور الـ CTA النهائي على الشاشة.

## التسليم والتنظيم

احفظ كل مخرجات هذا البوست في:
`campaigns/<اسم-المنتج>/02-visuals/week-<N>/day-<N>-<وصف-مختصر>/`
وبداخله: `design-spec.md` (التصميم + الشوت ليست + ملاحظات المونتاج)، وأي صور/فيديو تم توليده فعليًا.

في نهاية ردك، اذكر للمستخدم مكان حفظ كل شيء، وأن هذا آخر خطوة في خط الإنتاج لهذا البوست — جاهز للمراجعة والنشر.
