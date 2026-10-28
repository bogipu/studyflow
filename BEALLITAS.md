# StudyFlow – egy PIN az egész oldalhoz

- Cloudflare Pages projekt: `studyflow-pages`.
- Production D1 binding: `DB` → `studyflow-db`.
- Production Secret: `STUDYFLOW_PIN` = a saját, pontosan 6 számjegyű PIN.
- **Nem kell `STUDYFLOW_SESSION_SECRET`.** A munkamenet 256 bites véletlen tokennel működik, amelynek csak SHA-256 lenyomata kerül a meglévő D1-adatbázisba.
- A teljes ZIP tartalmát a GitHub `studyflow` repo gyökerébe töltsd fel (a `functions/` mappával együtt), a `main` ágra. A GitHub-integráció új Pages telepítést indít.
- A Cloudflare `studyflow-pages` Production környezetében ellenőrizd, hogy a `STUDYFLOW_PIN` ténylegesen elérhető.
- Éles ellenőrzés: kijelentkezve `/index.html` a `/belepes.html` oldalra irányítson; `/api/planner` 401-et adjon; helyes PIN után működjön; kijelentkezés után újra kérjen PIN-t.
- Az `health_days` táblába kerülnek az Egészség napjai; a meglévő planner táblát nem törli és nem módosítja.
- A korábban létrehozott külön `studyflow-health-private` adatbázist nem használja. Ne töröld, amíg nem ellenőrizted, hogy üres.

**Biztonság:** a hatjegyű PIN gyengébb a hosszú jelszónál. A belépés IP-címenként öt hibás próbálkozás után 15 percre korlátoz; emellett globális próbálkozáskorlát is van, ami túlterheléskor téged is kizárhat átmenetileg. Cloudflare WAF rate limit ajánlott. A kód statikus és szintaktikai ellenőrzése nem helyettesíti az éles tesztet. Ha a régi Worker domain (`studyflow.bogi-d7b.workers.dev`) külön nyilvános weboldalt szolgál ki, azt külön ellenőrizni kell, mert ez a Pages-projekt PIN-je nem védi automatikusan.
