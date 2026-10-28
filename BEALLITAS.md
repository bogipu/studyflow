# StudyFlow – egyetlen 6 számjegyű PIN 🎀

1. Cloudflare Pages projekt: **studyflow-pages** (nem a külön `studyflow` Worker).
2. Settings → Bindings: a meglévő `DB` kötés mutasson a `studyflow-db` adatbázisra. Nem kell második adatbázis.
3. Settings → Variables and secrets: `STUDYFLOW_PIN` (Secret, pontosan 6 számjegy) és `STUDYFLOW_SESSION_SECRET` (Secret, legalább 32 véletlen karakter) a **Production** környezetben. PIN-t soha ne tegyél GitHubra.
4. A ZIP **tartalmát** másold a GitHub repo gyökerébe, a `functions/` mappával együtt. A régi fájlokat frissítsd, de a feladatadatbázist ne töröld. A Cloudflare Pages GitHub-integrációja ezután új buildet indít.
5. A `studyflow-pages-2tu.pages.dev` címen teszteld: belépés nélkül a kezdőlap és a `/api/planner` sem érhető el; helyes PIN után minden oldal működik; kijelentkezés után ismét PIN kell.
6. Egészség ♡: a régi böngészőben megnyitva felajánlja a helyi napok importálását. A felhőben a `DB` adatbázis `health_days` táblájába kerülnek, a planner külön `planner_data` táblája megmarad.

**Fontos:** A PIN 1 000 000 lehetséges kombinációja miatt gyengébb egy hosszú jelszónál. Az alkalmazás IP-címenként 5 hibás próbálkozás után 15 percre korlátoz, de egy nagyobb támadás ellen Cloudflare WAF/rate limiting is ajánlott. A szerveroldali middleware és az API-védelem működését éles telepítés után ellenőrizni kell. A PIN csak akkor véd, ha a Pages Functions aktív és a weboldal nem érhető el másik, védetlen domainen vagy deployon. A Cloudflare D1 tárolás nem végponttól végpontig titkosított.
