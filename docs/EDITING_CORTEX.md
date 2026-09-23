# Cortex AI — Easy Editing

روزمره‌ترین تغییرات Cortex از Control Center قابل انجام‌اند: نام/متن محصول، theme، سقف Knowledge، ترتیب و برچسب منو، نمایش منوها، Hero/Quick Actions/Recent/Activity داشبورد، پنل برند Login و CTA ساخت Agent.

برای تغییرات ساختاری، registry مرکزی `src/config/cortex-ui.ts` و settings storage `src/lib/site-settings.ts` مرجع هستند. UI باید داده‌های قابل ویرایش را از `/api/site-config` بخواند و از hardcode تکراری پرهیز شود.
