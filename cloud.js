/* Monkey Family : connexion Supabase.
   Le jeu a été écrit pour un petit magasin de "documents" (db), un compte (user) et un stockage de fichiers (assets).
   Ce fichier fournit les mêmes fonctions au-dessus de Supabase, via window.claude.use(nom). */
(function(){
  const CFG = window.MF_CONFIG;
  const sb = supabase.createClient(CFG.url, CFG.key, {auth:{persistSession:true, autoRefreshToken:true, storageKey:"mf-auth"}});
  window.MF_SB = sb;
  const EMAIL_DOMAIN = "joueurs.monkey-family.app";
  const b64u = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  const unb64u = s => decodeURIComponent(escape(atob(s.replace(/-/g,"+").replace(/_/g,"/"))));
  const rnd = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(x=>x.toString(16).padStart(2,"0")).join(""); };
  const linkFor = (email, secret) => location.origin + location.pathname + "?k=" + b64u(JSON.stringify({e:email, p:secret}));

  /* ---------- session ---------- */
  let session = null, isAdmin = false, member = null, readyResolve;
  const ready = new Promise(r => readyResolve = r);

  async function loadMe(){
    const uid = session.user.id;
    const [{data:adm}, {data:mem}] = await Promise.all([
      sb.from("admins").select("uid").eq("uid", uid).maybeSingle(),
      sb.from("members").select("uid,pseudo,active").eq("uid", uid).maybeSingle()]);
    isAdmin = !!adm; member = mem || null;
  }

  async function boot(){
    const qs = new URLSearchParams(location.search);
    const k = qs.get("k");
    if (k){
      try{
        const {e, p} = JSON.parse(unb64u(k));
        await sb.auth.signOut().catch(()=>{});
        const {data, error} = await sb.auth.signInWithPassword({email:e, password:p});
        if (error) throw error;
        session = data.session;
      }catch(err){ gate("badlink"); return; }
      qs.delete("k"); history.replaceState(null, "", location.pathname + (qs.toString() ? "?" + qs : "") + location.hash);
    }
    if (!session){ const {data} = await sb.auth.getSession(); session = data.session; }
    if (!session){ gate(qs.has("setup") ? "setup" : "nolink"); return; }
    if (switchedAccount(session.user.id)) return;
    try{ await loadMe(); }catch(e){ gate("offline"); return; }
    if (!isAdmin && !(member && member.active)){ gate("disabled"); return; }
    document.documentElement.classList.add("mf-in");
    hideGate();
    readyResolve();
  }

  /* Un autre compte s'ouvre sur cet appareil (ex. : tu testes le lien d'un pote) : la collection locale du compte
     précédent ne doit pas lui être donnée. On vide les données de jeu locales et on recharge. */
  function switchedAccount(uid){
    let last = null; try{ last = localStorage.getItem("mf-uid"); }catch(e){}
    try{ localStorage.setItem("mf-uid", uid); }catch(e){}
    if (!last || last === uid) return false;
    try{
      Object.keys(localStorage).filter(k => k.startsWith("booster-proto-v1")).forEach(k => localStorage.removeItem(k));
      const pr = JSON.parse(localStorage.getItem("mf-prefs") || "{}"); delete pr.pseudo; localStorage.setItem("mf-prefs", JSON.stringify(pr));
    }catch(e){}
    location.replace(location.pathname);
    return true;
  }

  /* ---------- écran d'accueil (pas connecté) ---------- */
  function gate(kind){
    const g = document.getElementById("mfgate"); if (!g) return;
    const msg = {
      nolink: ["Monkey Family est un jeu privé.", "Ouvre le lien personnel que Kévin t'a envoyé pour entrer. Garde-le bien : il te permet de retrouver ta collection sur n'importe quel appareil."],
      badlink: ["Ce lien ne marche plus.", "Il a peut-être été remplacé. Demande un nouveau lien à Kévin."],
      disabled: ["Ton accès est en pause.", "Demande à Kévin de le réactiver."],
      offline: ["Connexion impossible.", "Vérifie ta connexion internet puis recharge la page."],
      setup: ["Installation", "Crée le compte administrateur. Ce sera ton compte de joueur aussi."]}[kind];
    g.querySelector("h1").textContent = msg[0];
    g.querySelector("p").textContent = msg[1];
    const f = g.querySelector("form");
    f.hidden = kind !== "setup";
    if (kind === "offline"){ const b = g.querySelector(".retry"); b.hidden = false; b.onclick = () => location.reload(); }
    g.hidden = false;
    f.onsubmit = async ev => {
      ev.preventDefault();
      const pseudo = f.querySelector("input").value.trim(); if (!pseudo) return;
      const out = g.querySelector(".out"); out.textContent = "Création…";
      try{
        const email = rnd(10) + "@" + EMAIL_DOMAIN, secret = rnd(24);
        const {data, error} = await sb.auth.signUp({email, password:secret});
        if (error) throw error;
        if (!data.session) throw new Error("Désactive « Confirm email » dans Supabase puis réessaie.");
        session = data.session;
        const {data:ok, error:e2} = await sb.rpc("claim_first_admin", {p_pseudo:pseudo});
        if (e2) throw e2;
        if (!ok) throw new Error("Un administrateur existe déjà.");
        const link = linkFor(email, secret);
        out.innerHTML = "";
        const t = document.createElement("p"); t.textContent = "C'est fait. Voici TON lien personnel : garde-le précieusement (il sert à te reconnecter sur un autre appareil)."; out.appendChild(t);
        const i = document.createElement("input"); i.value = link; i.readOnly = true; i.className = "mflink"; out.appendChild(i);
        const go = document.createElement("button"); go.type = "button"; go.textContent = "Entrer dans le jeu"; go.className = "mfbtn";
        go.onclick = () => { location.href = location.pathname; }; out.appendChild(go);
        f.hidden = true;
      }catch(err){ out.textContent = "Erreur : " + (err.message || err); }
    };
  }
  function hideGate(){ const g = document.getElementById("mfgate"); if (g) g.hidden = true; }

  /* ---------- db : documents rangés par chemin ---------- */
  const parentOf = p => p.replace(/\/[^/]+$/, "");
  const idOf = p => p.split("/").pop();
  const snapDoc = (path, row) => ({id:idOf(path), exists:!!row, data:() => row ? row.data : undefined});

  function doc(path){
    return {
      path,
      async get(){ const {data, error} = await sb.from("docs").select("data").eq("path", path).maybeSingle(); if (error) throw error; return snapDoc(path, data); },
      async set(d){ const {error} = await sb.from("docs").upsert({path, coll:parentOf(path), data:JSON.parse(JSON.stringify(d))}); if (error) throw error; },
      async update(patch){
        const {data, error} = await sb.from("docs").select("data").eq("path", path).maybeSingle(); if (error) throw error;
        const merged = Object.assign({}, data ? data.data : {}, JSON.parse(JSON.stringify(patch)));
        Object.keys(merged).forEach(k => { if (merged[k] && merged[k].__delete__) delete merged[k]; });
        const {error:e2} = await sb.from("docs").upsert({path, coll:parentOf(path), data:merged}); if (e2) throw e2; },
      async delete(){ const {error} = await sb.from("docs").delete().eq("path", path); if (error) throw error; }
    };
  }
  let chanN = 0;
  function collection(coll, ord, lim){
    async function query(){
      let q = sb.from("docs").select("path,data").eq("coll", coll);
      if (lim) q = q.order("updated_at", {ascending:false}).limit(lim);
      const {data, error} = await q; if (error) throw error;
      let rows = data || [];
      if (ord){ const [f, dir] = ord; rows.sort((a,b) => ((+a.data[f]||0) - (+b.data[f]||0)) * (dir === "desc" ? -1 : 1)); }
      const docs = rows.map(r => snapDoc(r.path, r));
      return {docs, size:docs.length, empty:!docs.length, docChanges:() => []};
    }
    return {
      orderBy:(f, d) => collection(coll, [f, d || "asc"], lim),
      limit:n => collection(coll, ord, n),
      doc:id => doc(coll + "/" + id),
      get:query,
      onSnapshot(cb, onErr){
        let alive = true, t = 0;
        const run = () => query().then(s => { if (alive) cb(s); }, e => { if (alive && onErr) onErr(e); });
        const later = () => { clearTimeout(t); t = setTimeout(run, 250); };
        run();
        const ch = sb.channel("mf-" + coll.replace(/[^a-z0-9]/gi, "_") + "-" + (++chanN))
          .on("postgres_changes", {event:"*", schema:"public", table:"docs", filter:"coll=eq." + coll}, later)
          .subscribe(st => { if (st === "SUBSCRIBED") later(); });
        // filet de sécurité si le temps réel est coupé (mise en veille du téléphone…)
        const poll = setInterval(() => { if (!document.hidden) run(); }, 60000);
        document.addEventListener("visibilitychange", () => { if (!document.hidden && alive) later(); });
        return () => { alive = false; clearInterval(poll); sb.removeChannel(ch); };
      }
    };
  }
  const DBAPI = {collection:c => collection(c), doc:p => doc(p)};

  /* ---------- user ---------- */
  const USERAPI = {
    isOwner: async () => isAdmin,
    canEdit: () => isAdmin,
    id: async () => session.user.id,
    me: async () => ({id:session.user.id, name:(member && member.pseudo) || ""}),
    async profiles(ids){
      const out = {}; ids.forEach(i => out[i] = {id:i, name:""});
      if (!ids.length) return out;
      const {data} = await sb.from("members").select("uid,pseudo").in("uid", ids);
      (data || []).forEach(m => out[m.uid] = {id:m.uid, name:m.pseudo});
      return out;
    }
  };

  /* ---------- médias : stockage privé + cache local (une image n'est téléchargée qu'une fois par appareil) ---------- */
  const MCACHE = "mf-media-v1", urls = new Map();
  async function mediaBlob(id){
    let cache = null;
    try{ cache = await caches.open(MCACHE); const hit = await cache.match("/media/" + id); if (hit) return await hit.blob(); }catch(e){}
    const {data, error} = await sb.storage.from("media").download(id);
    if (error) throw error;
    try{ if (cache) await cache.put("/media/" + id, new Response(data, {headers:{"Content-Type":data.type || "application/octet-stream"}})); }catch(e){}
    return data;
  }
  window.MF_MEDIA = {
    url(id){
      if (!urls.has(id)) urls.set(id, ready.then(() => mediaBlob(id)).then(b => URL.createObjectURL(b)).catch(e => { urls.delete(id); throw e; }));
      return urls.get(id);
    },
    has: async id => { try{ const c = await caches.open(MCACHE); return !!(await c.match("/media/" + id)); }catch(e){ return false; } }
  };
  const ASSETAPI = {
    async upload(blob){
      const id = rnd(16);
      const {error} = await sb.storage.from("media").upload(id, blob, {contentType:blob.type || "application/octet-stream", upsert:false, cacheControl:"31536000"});
      if (error) throw error;
      return {id, url:"", sizeBytes:blob.size, contentType:blob.type};
    }
  };

  /* ---------- admin : joueurs ---------- */
  window.MF_ADMIN = {
    isAdmin: () => isAdmin,
    async list(){ const {data, error} = await sb.from("members").select("uid,pseudo,active,created_at").order("created_at"); if (error) throw error; return data; },
    async add(pseudo){
      // un second client sans session, pour ne pas déconnecter l'admin
      const tmp = supabase.createClient(CFG.url, CFG.key, {auth:{persistSession:false, autoRefreshToken:false, storageKey:"mf-tmp"}});
      const email = rnd(10) + "@" + EMAIL_DOMAIN, secret = rnd(24);
      const {data, error} = await tmp.auth.signUp({email, password:secret});
      if (error) throw error;
      if (!data.user) throw new Error("Compte non créé");
      const {error:e2} = await sb.from("members").insert({uid:data.user.id, pseudo});
      if (e2) throw e2;
      return {uid:data.user.id, link:linkFor(email, secret)};
    },
    async newLink(uid){
      const secret = rnd(24);
      const {data:ok, error} = await sb.rpc("reset_member_secret", {p_uid:uid, p_secret:secret});
      if (error) throw error; if (!ok) throw new Error("Joueur introuvable");
      const {data:u} = await sb.rpc("member_email", {p_uid:uid});
      return linkFor(u, secret);
    },
    async setActive(uid, active){ const {error} = await sb.from("members").update({active}).eq("uid", uid); if (error) throw error; },
    async rename(uid, pseudo){ const {error} = await sb.from("members").update({pseudo}).eq("uid", uid); if (error) throw error; },
    // envoi groupé des images/sons (fichiers nommés <id>.<ext>) et des réglages d'illustrations
    async importFiles(files, onProgress){
      const list = [...files]; let done = 0, sent = 0, skipped = 0, docs = 0, failed = [];
      const {data:existing} = await sb.storage.from("media").list("", {limit:10000});
      const have = new Set((existing || []).map(o => o.name));
      const json = list.find(f => /artworks\.json$/i.test(f.name));
      const media = list.filter(f => /\.(webp|png|jpe?g|gif|mp4|webm|mp3|m4a|ogg)$/i.test(f.name));
      let i = 0;
      async function worker(){
        while (i < media.length){
          const f = media[i++], id = f.name.replace(/\.[^.]+$/, "");
          if (have.has(id)){ skipped++; }
          else {
            const {error} = await sb.storage.from("media").upload(id, f, {contentType:f.type || "application/octet-stream", upsert:true, cacheControl:"31536000"});
            if (error) failed.push(f.name + " : " + error.message); else sent++;
          }
          done++; onProgress && onProgress(done, media.length);
        }
      }
      await Promise.all([worker(), worker(), worker(), worker()]);
      if (json){
        const all = JSON.parse(await json.text());
        const rows = Object.entries(all).map(([path, data]) => ({path, coll:parentOf(path), data}));
        for (let k = 0; k < rows.length; k += 100){
          const {error} = await sb.from("docs").upsert(rows.slice(k, k + 100));
          if (error) failed.push("réglages : " + error.message); else docs += rows.slice(k, k + 100).length;
        }
      }
      return {sent, skipped, docs, failed};
    }
  };

  window.claude = {use: async name => {
    await ready;
    if (name === "db") return DBAPI;
    if (name === "user") return USERAPI;
    if (name === "assets") return isAdmin ? ASSETAPI : null;
    return null;
  }};
  window.MF_READY = ready;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
