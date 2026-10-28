# StudyFlow PIN – pontos hibajelzés

Ez a változat **nem kapcsolja ki a PIN-védelmet**. Ha hiányzik egy Cloudflare beállítás, a korábbi általános hiba helyett megnevezi, melyik hiányzik vagy hibás. A titkos értékeket soha nem írja ki.

1. Töltsd fel a ZIP **tartalmát** a `bogipu/studyflow` GitHub-tárhely gyökerébe. A `functions/` mappa is kerüljön fel.
2. Cloudflare → **studyflow-pages** → Settings → Variables and secrets → **Production**: `STUDYFLOW_PIN` = pontosan 6 számjegy; `STUDYFLOW_SESSION_SECRET` = legalább 32 karakter. Mindkettő Secret típus. Ne küldd el az értéküket.
3. Settings → Bindings → **Production**: `DB` → `studyflow-db`.
4. Várd meg az új sikeres deploymentet. Ha továbbra is hiba van, az oldal most már megmondja a pontos hibás beállítás nevét.
5. Teszteld: kijelentkezve a főoldal és az `/api/planner` ne legyen elérhető, belépés után viszont igen.

**Megjegyzés:** A korábbi csomag beállítási hibája nem feltétlenül kódhiba: például a túl rövid session secret, rossz Production környezet vagy régi deployment is ugyanazt az általános üzenetet okozta. A mostani változat ezek megkülönböztetését segíti.
