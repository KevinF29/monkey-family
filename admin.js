/* Monkey Family : écran admin (joueurs, liens personnels, import des médias) et installation de l'appli */
(function(){
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

  function addSettingsRows(){
    const box = document.querySelector("#settings .sheetbox"); if (!box || $("mfInstallRow")) return;
    const save = $("saveState");
    const inst = document.createElement("div"); inst.className = "srow"; inst.id = "mfInstallRow";
    inst.innerHTML = `<span class="sl"><b>Appli</b><small id="mfInstallTxt">Ajoute Monkey Family sur ton écran d'accueil</small></span><button type="button" class="sbtn" id="mfInstallBtn">Installer</button>`;
    box.insertBefore(inst, save);
    const nt = document.createElement("div"); nt.className = "srow"; nt.id = "mfPushRow";
    nt.innerHTML = `<span class="sl"><b>Notifications</b><small id="mfPushSum">Boosters, événements, enchères</small></span><button type="button" class="sbtn" id="mfNotifBtn" aria-controls="mfNotif" aria-expanded="false">Choisir ›</button>`;
    box.insertBefore(nt, save);
    const np = document.createElement("div"); np.id = "mfNotif"; np.hidden = true;
    np.innerHTML = `<div class="nfhead"><button type="button" class="sbtn" id="mfNotifBack">‹ Retour</button><h2>Notifications</h2></div>
      <div class="srow"><label class="sl" for="mfPushOn"><b>Toutes les notifications</b><small id="mfPushTxt">Sur cet appareil</small></label><input type="checkbox" class="switch" id="mfPushOn" role="switch" aria-describedby="mfPushTxt"></div>
      <div class="srow nfsub"><label class="sl" for="nfPacks"><b>Boosters disponibles</b><small>Quand un booster est prêt à ouvrir</small></label><input type="checkbox" class="switch" id="nfPacks" data-k="packs" role="switch"></div>
      <div class="srow nfsub"><label class="sl" for="nfEvents"><b>Événements</b><small>Cadeaux, boosters offerts et événements spéciaux</small></label><input type="checkbox" class="switch" id="nfEvents" data-k="events" role="switch"></div>
      <div class="srow nfsub"><label class="sl" for="nfAuctions"><b>Enchères</b><small>Quand quelqu'un enchérit au-dessus de toi</small></label><input type="checkbox" class="switch" id="nfAuctions" data-k="auctions" role="switch"></div>
      <p class="savestate" id="nfMsg" role="status"></p>`;
    box.appendChild(np);
    const st = document.createElement("style");
    st.textContent = `.sheetbox.nfopen>:not(#mfNotif){display:none}#mfNotif{display:grid;gap:14px}#mfNotif[hidden]{display:none}.nfhead{display:flex;align-items:center;gap:12px}.nfhead h2{margin:0}.nfsub.off{opacity:.45}`;
    document.head.appendChild(st);
    const adm = document.createElement("div"); adm.className = "srow mfadminrow";
    adm.innerHTML = `<span class="sl"><b>Admin</b><small>Joueurs, liens personnels et médias</small></span><button type="button" class="sbtn" id="mfAdminBtn">Gérer</button>`;
    box.insertBefore(adm, save);
    $("mfAdminBtn").addEventListener("click", openAdmin);
    setupInstall();
    setupPush();
  }

  /* ---------- notifications ---------- */
  /* sous-menu des notifications : un interrupteur général (cet appareil) et un par type (enregistrés sur le serveur, pour le joueur) */
  const PREF = {packs:true, events:true, auctions:true}; let prefOk = null;
  function syncNotif(){
    const on = $("mfPushOn").checked;
    document.querySelectorAll("#mfNotif .nfsub").forEach(r => { const i = r.querySelector("input"); i.checked = !!PREF[i.dataset.k]; i.disabled = !on || prefOk === false; r.classList.toggle("off", !on || prefOk === false); });
    const names = [["packs", "boosters"], ["events", "événements"], ["auctions", "enchères"]].filter(([k]) => PREF[k]).map(([, n]) => n);
    $("mfPushSum").textContent = !on ? "Désactivées sur cet appareil" : names.length ? "Activées : " + names.join(", ") : "Activées, mais aucun type choisi";
  }
  async function loadPrefs(){
    try{ Object.assign(PREF, await window.MF_RPC("mf_notif_get")); prefOk = true; $("nfMsg").textContent = ""; }
    catch(e){ prefOk = false; $("nfMsg").textContent = "Le choix par type n'est pas encore installé sur le serveur : tu reçois toutes les notifications."; }
    syncNotif();
  }
  function setupNotifMenu(){
    const box = document.querySelector("#settings .sheetbox"), btn = $("mfNotifBtn"), panel = $("mfNotif");
    const openSub = () => { box.classList.add("nfopen"); panel.hidden = false; btn.setAttribute("aria-expanded", "true"); loadPrefs(); $("mfNotifBack").focus(); };
    const closeSub = () => { box.classList.remove("nfopen"); panel.hidden = true; btn.setAttribute("aria-expanded", "false"); };
    btn.addEventListener("click", openSub);
    $("mfNotifBack").addEventListener("click", () => { closeSub(); btn.focus(); });
    new MutationObserver(() => { if ($("settings").hidden) closeSub(); }).observe($("settings"), {attributes:true, attributeFilter:["hidden"]});
    panel.querySelectorAll(".nfsub input").forEach(i => i.addEventListener("change", async () => {
      const k = i.dataset.k, v = i.checked; PREF[k] = v; syncNotif(); i.disabled = true;
      try{ Object.assign(PREF, await window.MF_RPC("mf_notif_set", {p:{[k]:v}})); $("nfMsg").textContent = "Enregistré."; }
      catch(e){ PREF[k] = !v; $("nfMsg").textContent = "Enregistrement impossible pour l'instant, réessaie."; }
      syncNotif();
    }));
    if (window.MF_RPC) loadPrefs(); else syncNotif();
  }
  async function setupPush(){
    const sw = $("mfPushOn"), txt = $("mfPushTxt"), P = window.MF_PUSH;
    const say = t => { txt.textContent = t; };
    setupNotifMenu();
    if (!P || !P.supported()){
      sw.disabled = true;
      say(P && P.ios() && !P.standalone() ? "Sur iPhone : installe d'abord l'appli sur l'écran d'accueil (ligne « Appli »), puis active-les depuis l'appli." : "Non disponibles sur ce navigateur.");
      return;
    }
    const refresh = async () => { sw.checked = Notification.permission === "granted" && !!(await P.current()); syncNotif(); };
    await refresh();
    if (Notification.permission === "denied") say("Bloquées dans les réglages du navigateur : autorise-les pour ce site.");
    sw.addEventListener("change", async () => {
      sw.disabled = true;
      try{
        if (sw.checked){ await P.enable(); say("Activées sur cet appareil : choisis ci-dessous ce qui te prévient."); }
        else { await P.disable(); say("Désactivées sur cet appareil."); }
      }catch(e){
        const m = String(e && e.message || e);
        say(m === "denied" ? "Refusées : autorise les notifications pour ce site dans les réglages du navigateur." : m === "dismissed" ? "Pas encore autorisées : réessaie et choisis « Autoriser »." : "Activation impossible pour l'instant, réessaie.");
      }
      await refresh(); sw.disabled = false;
    });
  }

  /* ---------- installation (écran d'accueil) ---------- */
  let deferred = null;
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; });
  function setupInstall(){
    const btn = $("mfInstallBtn"), txt = $("mfInstallTxt");
    const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    if (standalone){ txt.textContent = "Installée sur cet appareil"; btn.hidden = true; return; }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    btn.addEventListener("click", async () => {
      if (deferred){ deferred.prompt(); try{ await deferred.userChoice; }catch(e){} deferred = null; return; }
      txt.textContent = ios ? "Dans Safari : bouton Partager, puis « Sur l'écran d'accueil »."
                            : "Dans le menu du navigateur : « Installer l'application » ou « Ajouter à l'écran d'accueil ».";
    });
  }

  /* ---------- panneau admin ---------- */
  function ensurePanel(){
    if ($("mfadmin")) return $("mfadmin");
    const d = document.createElement("div"); d.id = "mfadmin"; d.className = "shop"; d.hidden = true;
    d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", "Admin");
    d.innerHTML = `<div class="shopbox"><div class="shophead"><b>Admin</b><span class="shopbal" id="mfaCount"></span><button class="bbtn" id="mfaClose" type="button" aria-label="Fermer">✕</button></div>
      <div class="stabs" role="tablist"><button type="button" role="tab" data-mt="players" aria-selected="true">Joueurs</button><button type="button" role="tab" data-mt="events" aria-selected="false">Événements</button><button type="button" role="tab" data-mt="import" aria-selected="false">Importer les médias</button><button type="button" role="tab" data-mt="export" aria-selected="false">Exporter pour Claude</button><button type="button" role="tab" data-mt="errs" aria-selected="false">Bugs</button></div>
      <div class="shopbody" id="mfaBody"></div></div>`;
    document.body.appendChild(d);
    $("mfaClose").addEventListener("click", closeAdmin);
    d.querySelectorAll("[data-mt]").forEach(b => b.addEventListener("click", () => { tab = b.dataset.mt; render(); }));
    document.addEventListener("keydown", e => { if (!d.hidden && e.key === "Escape") closeAdmin(); });
    return d;
  }
  let tab = "players";
  function openAdmin(){ const s = $("settings"); if (s) s.hidden = true; const d = ensurePanel(); d.hidden = false; document.body.style.overflow = "hidden"; render(); }
  function closeAdmin(){ $("mfadmin").hidden = true; document.body.style.overflow = ""; }
  function render(){
    const d = $("mfadmin"); d.querySelectorAll("[data-mt]").forEach(b => b.setAttribute("aria-selected", b.dataset.mt === tab));
    if (tab === "players") renderPlayers(); else if (tab === "events") renderEvents(); else if (tab === "import") renderImport(); else if (tab === "errs") renderErrs(); else renderExport();
  }
  function linkBox(link, label){
    return `<div class="mflinkbox"><p class="shint">${label}</p><input class="mflink" readonly value="${esc(link)}"><button type="button" class="sbtn mfcopy">Copier le lien</button></div>`;
  }
  function wireCopy(root){
    root.querySelectorAll(".mfcopy").forEach(b => b.addEventListener("click", async () => {
      const i = b.parentNode.querySelector(".mflink");
      try{ await navigator.clipboard.writeText(i.value); b.textContent = "Copié !"; }catch(e){ i.select(); b.textContent = "Sélectionné, copie-le"; }
      setTimeout(() => b.textContent = "Copier le lien", 1800);
    }));
  }
  async function renderPlayers(note){
    const body = $("mfaBody");
    body.innerHTML = `<form class="mfadd" id="mfAdd"><input type="text" id="mfPseudo" maxlength="20" placeholder="Pseudo du nouveau joueur" autocomplete="off" required><button class="sbtn" type="submit">Créer son accès</button></form>
      <div id="mfNote">${note || ""}</div><p class="shint">Chargement…</p>`;
    wireCopy(body);
    $("mfAdd").addEventListener("submit", async e => {
      e.preventDefault(); const p = $("mfPseudo").value.trim(); if (!p) return;
      const btn = e.target.querySelector("button"); btn.disabled = true; btn.textContent = "Création…";
      try{ const r = await MF_ADMIN.add(p); renderPlayers(linkBox(r.link, `Lien personnel de <b>${esc(p)}</b> : envoie-le-lui, il l'ouvre une fois et garde le lien.`)); }
      catch(err){ btn.disabled = false; btn.textContent = "Créer son accès"; $("mfNote").innerHTML = `<p class="shint mferr">${esc(/duplicate|unique/i.test(err.message) ? "Ce pseudo existe déjà." : err.message)}</p>`; }
    });
    let list = [], packs = null;
    try{ [list, packs] = await Promise.all([MF_ADMIN.list(), window.MF_RPC("mf_admin_players").catch(() => null)]); }catch(err){ body.querySelector(".shint:last-child").textContent = "Erreur : " + err.message; return; }
    $("mfaCount").textContent = list.length + " joueur" + (list.length > 1 ? "s" : "");
    const P = Object.fromEntries((Array.isArray(packs) ? packs : []).map(x => [x.uid, x]));
    const hm = ms => { const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0") : m + " min"; };
    const packInfo = x => !x ? "" : ` · 🎴 <b data-stock="${x.uid}">${x.stock}</b> booster${x.stock > 1 ? "s" : ""} à ouvrir` + (x.nextAt ? ` (prochain dans ${hm(x.nextAt - x.now)})` : "") + ` · ${x.opened} ouvert${x.opened > 1 ? "s" : ""} · 🍌 ${x.bananas}`;
    const rows = list.map(m => `<div class="sitem" style="display:grid;grid-template-columns:minmax(0,1fr)"><span class="sname">${esc(m.pseudo)}<small style="display:block;line-height:1.45">${m.active ? "Actif" : "En pause"} · ${new Date(m.created_at).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"})}${packInfo(P[m.uid])}</small></span>
      <span class="mfbtns">${P[m.uid] ? `<button class="sbtn" data-give="${m.uid}" data-p="${esc(m.pseudo)}">+1 booster</button>` : ""}<button class="sbtn" data-link="${m.uid}" data-p="${esc(m.pseudo)}">Nouveau lien</button><button class="sbtn" data-act="${m.uid}" data-on="${m.active ? 0 : 1}">${m.active ? "Mettre en pause" : "Réactiver"}</button></span></div>`).join("");
    body.querySelector(".shint:last-child").outerHTML = `${packs ? "" : `<p class="shint mferr">Boosters des joueurs indisponibles : lance d'abord le script SQL de sécurisation dans Supabase.</p>`}<p class="shint">« Nouveau lien » remplace l'ancien (qui ne marchera plus) : la collection du joueur est conservée.</p><div class="slist">${rows}</div>`;
    body.querySelectorAll("[data-link]").forEach(b => b.addEventListener("click", async () => {
      if (b.dataset.sure !== "1"){ b.dataset.sure = "1"; b.textContent = "Confirmer ?"; setTimeout(() => { b.dataset.sure = ""; b.textContent = "Nouveau lien"; }, 3000); return; }
      b.disabled = true;
      try{ const l = await MF_ADMIN.newLink(b.dataset.link); renderPlayers(linkBox(l, `Nouveau lien de <b>${b.dataset.p}</b> (l'ancien ne marche plus) :`)); }
      catch(err){ b.disabled = false; $("mfNote").innerHTML = `<p class="shint mferr">${esc(err.message)}</p>`; }
    }));
    body.querySelectorAll("[data-give]").forEach(b => b.addEventListener("click", async () => {
      b.disabled = true;
      try{ const x = await window.MF_RPC("mf_admin_give", {p_uid: b.dataset.give, p_n: 1}); const el = body.querySelector(`[data-stock="${b.dataset.give}"]`); if (el) el.textContent = x.stock;
        $("mfNote").innerHTML = `<p class="shint">+1 booster pour <b>${b.dataset.p}</b> (${x.stock} à ouvrir).</p>`; }
      catch(err){ $("mfNote").innerHTML = `<p class="shint mferr">${esc(err.message)}</p>`; }
      b.disabled = false;
    }));
    body.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", async () => {
      b.disabled = true; try{ await MF_ADMIN.setActive(b.dataset.act, b.dataset.on === "1"); renderPlayers(); }catch(err){ b.disabled = false; }
    }));
  }
  /* ---------- événements : boosters offerts, boosters spéciaux, attente réduite ---------- */
  const KINDS = {gift:"🎁 Boosters offerts", special:"✨ Boosters spéciaux offerts", xpack:"🎁 Booster exclusif (cartes choisies)", card:"🃏 Carte exclusive offerte", speed:"⚡ Attente réduite"};
  const SKINS = {noel:"Noël", gaming:"Lancement (gaming)"};
  const pad = n => String(n).padStart(2, "0");
  const localInput = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmt = t => new Date(t).toLocaleString("fr-FR", {weekday:"short", day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit"});
  async function renderEvents(edit){
    const body = $("mfaBody"); body.innerHTML = `<p class="shint">Chargement…</p>`;
    let list = [];
    try{ list = await window.MF_RPC("mf_events_admin"); }
    catch(err){ body.innerHTML = /PGRST202|Could not find|does not exist/i.test(err.message) ? `<p class="shint mferr">Les événements ne sont pas encore installés : lance le script supabase-v3.sql dans Supabase.</p>` : `<p class="shint mferr">${esc(err.message)}</p>`; return; }
    const e = edit || {};
    // who can be the only one to receive a gift: a player, or the admin himself for tests
    let members = [], meId = "";
    try{ [members, meId] = await Promise.all([MF_ADMIN.list().catch(() => []), MF_SB.auth.getSession().then(r => r.data.session.user.id).catch(() => "")]); }catch(err){}
    const who = uid => !uid ? "" : uid === meId ? "toi (admin)" : ((members.find(m => m.uid === uid) || {}).pseudo || "un joueur");
    const ex = (window.MF_EXCL_CARDS ? window.MF_EXCL_CARDS() : []).sort((a, b) => (b.ev - a.ev) || a.name.localeCompare(b.name, "fr"));
    const exName = k => { const c = ex.find(x => x.key === k); return c ? c.name : k; };
    const now = Date.now(), start = e.starts || now, end = e.ends || now + 2 * 86400000;
    const GIFT = k => k !== "speed";  // gifts are handed out at one fixed date and time
    const state = x => GIFT(x.kind) ? (x.starts > now ? "Programmé" : "Distribué") : x.ends <= now ? "Terminé" : x.starts > now ? "À venir" : "En cours";
    const BANNER = 2 * 86400000;  // a gift stays announced on the players' screen for 2 days
    body.innerHTML = `<form class="mfev" id="mfEvForm">
        <p class="shint">${e.id ? "Modifier l'événement" : "Nouvel événement"} : les cadeaux arrivent tout seuls chez chaque joueur à sa prochaine visite après la date choisie (une fois par joueur).</p>
        <label><span>Nom</span><input id="evTitle" maxlength="60" required value="${esc(e.title || "")}" placeholder="Noël, Week-end turbo…"></label>
        <label><span>Type</span><select id="evKind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${e.kind === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label id="evBWrap"><span>Nombre de boosters</span><input id="evBoosters" type="number" min="1" max="20" value="${e.boosters || 2}"></label>
        <label id="evCWrap"><span id="evCLab">Carte exclusive offerte</span><select id="evCard"></select></label>
        <div id="evXWrap" class="full"><span class="shint">Cartes du booster, dans l'ordre où elles sortent (de 1 à 9 cartes exclusives)</span><div class="evxgrid" id="evXCards"></div>
          <label><span>Emballage</span><select id="evSkin">${Object.entries(SKINS).map(([k, v]) => `<option value="${k}" ${e.skin === k ? "selected" : ""}>${v}</option>`).join("")}</select></label></div>
        <label id="evHWrap"><span>Un booster toutes les… (heures)</span><input id="evHours" type="number" min="1" max="8" step="0.5" value="${e.hours || 4}"></label>
        <label id="evAtWrap"><span>Offert le</span><input id="evAt" type="datetime-local" value="${localInput(start)}"></label>
        <label id="evSWrap"><span>Début</span><input id="evStart" type="datetime-local" value="${localInput(start)}"></label>
        <label id="evEWrap"><span>Fin</span><input id="evEnd" type="datetime-local" value="${localInput(end)}"></label>
        <label id="evTWrap" class="full"><span>Pour qui ?</span><select id="evTarget"><option value="">Tout le monde</option>${meId ? `<option value="${meId}" ${e.target === meId ? "selected" : ""}>Moi (admin, pour tester)</option>` : ""}${members.filter(m => m.uid !== meId).map(m => `<option value="${m.uid}" ${e.target === m.uid ? "selected" : ""}>${esc(m.pseudo || "?")}${m.active === false ? " (en pause)" : ""}</option>`).join("")}</select></label>
        <label class="full"><span>Message (facultatif)</span><input id="evMsg" maxlength="200" value="${esc(e.message || "")}" placeholder="Joyeux Noël la famille !"></label>
        <p class="shint full" id="evHelp"></p>
        <div class="mfbtns full">${e.id ? `<button type="button" class="sbtn" id="evCancel">Annuler</button>` : ""}<button type="submit" class="sbtn">${e.id ? "Enregistrer" : "Créer l'événement"}</button></div>
        <p class="shint full" id="evNote" role="status"></p>
      </form>
      <h3 class="mfh">Événements</h3>
      ${list.length ? list.map(x => `<div class="sitem" style="display:grid;grid-template-columns:minmax(0,1fr)"><span class="sname">${esc(x.title)} <small style="display:block;line-height:1.45">${KINDS[x.kind]}${x.kind === "speed" ? ` · 1 toutes les ${x.hours} h` : `${x.kind === "card" ? "" : ` · ${x.boosters} booster${x.boosters > 1 ? "s" : ""}`}${x.kind === "xpack" ? ` de ${(x.cards || []).length} carte${(x.cards || []).length > 1 ? "s" : ""} : ${(x.cards || []).map(k => esc(exName(k))).join(", ")}` : ""}${x.card ? ` · 🃏 ${esc(exName(x.card))}` : ""} · reçu par ${x.claims} joueur${x.claims > 1 ? "s" : ""}`}<br>${GIFT(x.kind) ? `Offert le ${fmt(x.starts)}${x.target ? ` · <b>pour ${esc(who(x.target))} seulement</b>` : ""}` : `${fmt(x.starts)} → ${fmt(x.ends)}`} · <b>${state(x)}</b>${x.message ? `<br>« ${esc(x.message)} »` : ""}</small></span>
        <span class="mfbtns"><button class="sbtn" data-ed="${x.id}">Modifier</button><button class="sbtn" data-del="${x.id}">Supprimer</button></span></div>`).join("") : `<p class="shint">Aucun événement pour l'instant.</p>`}`;
    const kind = $("evKind");
    const fillCards = () => { const need = kind.value === "card";
      $("evCard").innerHTML = (need ? "" : `<option value="">Aucune</option>`) + (ex.length ? ex.map(c => `<option value="${c.key}" ${e.card === c.key ? "selected" : ""}>${esc(c.name)}${c.ev ? "" : " (récompense « " + esc(c.cat) + " »)"}</option>`).join("") : `<option value="">Crée d'abord une carte exclusive dans le Studio</option>`);
      $("evCLab").textContent = need ? "Carte exclusive offerte" : "Carte exclusive en plus (facultatif)"; };
    const opts = sel => `<option value="">—</option>` + ex.map(c => `<option value="${c.key}" ${sel === c.key ? "selected" : ""}>${esc(c.name)}${c.ev ? "" : " (récompense)"}</option>`).join("");
    $("evXCards").innerHTML = Array.from({length:9}, (_, i) => `<label><span>Carte ${i + 1}</span><select data-xc="${i}">${opts((e.cards || [])[i] || "")}</select></label>`).join("");
    const sync = () => { const sp = kind.value === "speed", cd = kind.value === "card", xp = kind.value === "xpack"; $("evBWrap").hidden = sp || cd; $("evHWrap").hidden = !sp; $("evAtWrap").hidden = sp; $("evTWrap").hidden = sp; $("evSWrap").hidden = $("evEWrap").hidden = !sp; $("evCWrap").hidden = sp || xp; $("evXWrap").hidden = !xp; fillCards();
      $("evBoosters").max = xp ? 5 : 20; if (xp && +$("evBoosters").value > 5) $("evBoosters").value = 1;
      $("evHelp").textContent = sp ? "Pendant l'événement, chaque joueur reçoit un booster plus souvent (au lieu de toutes les 8 h). Le stock reste limité à 3."
        : xp ? (ex.length ? "Chaque joueur reçoit ce booster une fois, dès la date choisie, à sa prochaine visite (même s'il revient plus tard). Il contient exactement les cartes choisies, et passe avant les boosters normaux. Crée les cartes dans le Studio (« Carte exclusive », offerte pendant un événement)." : "Crée d'abord les cartes exclusives dans le Studio (« Carte exclusive », offerte pendant un événement).")
        : cd ? "Chaque joueur reçoit la carte une fois, dès la date choisie, à sa prochaine visite (même s'il revient plus tard), avec une notification à l'heure dite."
        : kind.value === "special" ? "Booster spécial : les deux dernières cartes ont de bien meilleures chances (Épique minimum sur la dernière). Il passe avant les boosters normaux."
        : "Dès la date choisie, chaque joueur reçoit les boosters à sa prochaine visite (même s'il revient plus tard). Ils s'ajoutent à son stock, même s'il est déjà plein.";
      if (!sp) $("evHelp").textContent += " Une notification part à l'heure dite, et l'annonce reste affichée 2 jours."; };
    kind.addEventListener("change", sync); sync();
    if ($("evCancel")) $("evCancel").addEventListener("click", () => renderEvents());
    $("evStart").addEventListener("change", () => { if (new Date($("evEnd").value) <= new Date($("evStart").value)) $("evEnd").value = localInput(new Date($("evStart").value).getTime() + 86400000); });
    $("mfEvForm").addEventListener("submit", async ev => {
      ev.preventDefault();
      const p = {id:e.id || null, title:$("evTitle").value.trim(), kind:kind.value, boosters:+$("evBoosters").value || 0, hours:+$("evHours").value || 8,
        starts:new Date(GIFT(kind.value) ? $("evAt").value : $("evStart").value).getTime(), ends:new Date($("evEnd").value).getTime(), message:$("evMsg").value.trim(), card:$("evCard").value || null, target:GIFT(kind.value) ? ($("evTarget").value || null) : null};
      if (p.kind === "xpack"){ p.card = null; p.skin = $("evSkin").value; p.cards = [...body.querySelectorAll("[data-xc]")].map(x => x.value).filter(Boolean);
        if (!p.cards.length){ $("evNote").innerHTML = `<span class="mferr">Choisis au moins une carte.</span>`; return; }
        if (new Set(p.cards).size !== p.cards.length){ $("evNote").innerHTML = `<span class="mferr">Une même carte est choisie deux fois.</span>`; return; }
        if (!p.boosters) p.boosters = 1; }
      if (p.kind === "card" && !p.card){ $("evNote").innerHTML = `<span class="mferr">Choisis la carte à offrir.</span>`; return; }
      if (!isFinite(p.starts)){ $("evNote").innerHTML = `<span class="mferr">Choisis la date et l'heure.</span>`; return; }
      if (GIFT(p.kind)) p.ends = p.starts + BANNER;
      if (!(p.ends > p.starts)){ $("evNote").innerHTML = `<span class="mferr">La fin doit être après le début.</span>`; return; }
      if (p.target){  // without the v12 script the server would ignore "Pour qui ?" and give the gift to everyone
        const {error:te} = await MF_SB.from("mf_events").select("target").limit(1);
        if (te && /target|column/i.test(te.message)){ $("evNote").innerHTML = `<span class="mferr">« Pour qui ? » n'est pas encore installé : lance le script supabase-v12.sql dans Supabase.</span>`; return; } }
      try{ await window.MF_RPC("mf_event_save", {p}); renderEvents(); }
      catch(err){ $("evNote").innerHTML = `<span class="mferr">${p.kind === "xpack" && /\bkind\b/.test(err.message) ? "Le booster exclusif n'est pas encore installé : lance le script supabase-v5.sql dans Supabase." : esc(err.message)}</span>`; }
    });
    body.querySelectorAll("[data-ed]").forEach(b => b.addEventListener("click", () => renderEvents(list.find(x => String(x.id) === b.dataset.ed))));
    body.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => {
      if (b.dataset.sure !== "1"){ b.dataset.sure = "1"; b.textContent = "Confirmer"; return; }
      b.disabled = true; try{ await window.MF_RPC("mf_event_delete", {p_id:+b.dataset.del}); }catch(err){} renderEvents();
    }));
  }

  function renderImport(){
    const body = $("mfaBody");
    body.innerHTML = `<p class="shint">Choisis tout le contenu du dossier « media » que Claude t'a envoyé (les images, les sons et le fichier artworks.json). Les fichiers déjà en ligne sont ignorés : tu peux relancer l'import sans risque.</p>
      <label class="sbtn big mffile">Choisir les fichiers<input type="file" id="mfFiles" multiple hidden></label>
      <label class="sbtn big mffile">…ou le dossier entier<input type="file" id="mfDir" webkitdirectory multiple hidden></label>
      <div id="mfImp"></div>`;
    const go = async files => {
      const out = $("mfImp"); if (!files.length) return;
      out.innerHTML = `<p class="shint">Envoi : <b id="mfPct">0</b> / ${files.length}</p><progress id="mfBar" max="1" value="0" style="width:100%"></progress>`;
      const r = await MF_ADMIN.importFiles(files, (d, n) => { $("mfPct").textContent = d; $("mfBar").max = n; $("mfBar").value = d; });
      out.innerHTML = `<p class="shint"><b>Terminé.</b> ${r.sent} fichier(s) envoyé(s), ${r.skipped} déjà en ligne, ${r.docs} réglage(s) d'illustration enregistré(s).</p>` +
        (r.failed.length ? `<p class="shint mferr">${r.failed.length} erreur(s) :<br>${r.failed.slice(0, 8).map(esc).join("<br>")}</p>` : `<p class="shint">Recharge la page pour voir les illustrations.</p>`);
    };
    $("mfFiles").addEventListener("change", e => go([...e.target.files]));
    $("mfDir").addEventListener("change", e => go([...e.target.files]));
  }

  async function renderErrs(){
    const body = $("mfaBody"); body.innerHTML = `<p class="shint">Chargement…</p>`;
    try{
      const [{data:pl}, list] = await Promise.all([MF_SB.from("docs").select("path,data").like("path", "data/users/%/errs"), MF_ADMIN.list()]);
      const name = Object.fromEntries(list.map(m => [m.uid, m.pseudo]));
      const rows = (pl || []).filter(r => r.data && r.data.errs && r.data.errs.length).map(r => {
        const uid = r.path.split("/")[2];
        return `<div class="mferrs"><b>${esc(name[uid] || uid)}</b>` + r.data.errs.slice().reverse().map(e =>
          `<p class="shint"><span>${new Date(e.t).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span> — ${esc(e.m)}<br><small>${esc(e.w)} · ${esc(e.ua)}</small></p>`).join("") + `</div>`;
      }).join("");
      body.innerHTML = `<p class="shint">Les erreurs rencontrées par chaque joueur (les 10 dernières). Envoie une capture de cet écran à Claude s'il y a un souci.</p>` + (rows || `<p class="shint"><b>Aucune erreur signalée.</b></p>`);
    }catch(err){ body.innerHTML = `<p class="shint mferr">${esc(err.message)}</p>`; }
  }

  function renderExport(){
    const body = $("mfaBody");
    body.innerHTML = `<p class="shint">Après avoir ajouté des images, renommé ou créé des cartes dans le Studio : télécharge ce fichier et envoie-le à Claude. Il mettra à jour le Google Sheet et le jeu.</p>
      <button type="button" class="sbtn big" id="mfExp">Télécharger le fichier</button><div id="mfExpOut"></div>`;
    $("mfExp").addEventListener("click", async () => {
      const out = $("mfExpOut"); out.innerHTML = `<p class="shint">Préparation…</p>`;
      try{
        const {data, error} = await MF_SB.from("docs").select("path,data,updated_at").in("coll", ["artworks", "newcards"]);
        if (error) throw error;
        const dump = {exported:new Date().toISOString(), docs:Object.fromEntries(data.map(r => [r.path, {...r.data, _updated:r.updated_at}]))};
        const blob = new Blob([JSON.stringify(dump)], {type:"application/json"});
        const name = "monkey-family-export-" + new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-") + ".json";
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
        out.innerHTML = `<p class="shint"><b>${name}</b> téléchargé (${data.length} éléments). Envoie-le à Claude.</p>`;
      }catch(err){ out.innerHTML = `<p class="shint mferr">${esc(err.message)}</p>`; }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addSettingsRows); else addSettingsRows();
})();
