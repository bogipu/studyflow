# StudyFlow – 6 számjegyű PIN ♡

1. Töltsd fel a teljes csomag tartalmát a GitHub `studyflow` repóba (a `functions` mappával együtt).
2. Cloudflare Pages → Settings → Variables and Secrets: `HEALTH_PASSWORD` értéke **pontosan 6 számjegy**; `HEALTH_SESSION_SECRET` legalább 32 véletlen karakter. Mindkettő legyen Secret, ne kerüljön GitHubra.
3. Cloudflare Pages → Settings → Bindings: `HEALTH_DB` legyen a külön D1 adatbázis, a meglévő `DB` kötés maradjon.
4. Indíts új deploymentet, majd ellenőrizd, hogy a kezdőlap PIN-t kér, a hibás PIN-t elutasítja, 5 hibás kísérlet után ideiglenesen blokkol, és a belépés után minden oldal elérhető.
5. Az Egészség oldalon a régi böngésző helyi adatait csak jóváhagyással importáld.

**Figyelem:** A 6 számjegyű PIN kisebb biztonságot ad, mint egy hosszú jelszó. A globális korlátozás miatt mások is okozhatnak 15 perces belépési szünetet. Az éles működést telepítés után ellenőrizni kell.
