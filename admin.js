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
    const adm = document.createElement("div"); adm.className = "srow mfadminrow";
    adm.innerHTML = `<span class="sl"><b>Admin</b><small>Joueurs, liens personnels et médias</small></span><button type="button" class="sbtn" id="mfAdminBtn">Gérer</button>`;
    box.insertBefore(adm, save);
    $("mfAdminBtn").addEventListener("click", openAdmin);
    setupInstall();
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
      <div class="stabs" role="tablist"><button type="button" role="tab" data-mt="players" aria-selected="true">Joueurs</button><button type="button" role="tab" data-mt="import" aria-selected="false">Importer les médias</button></div>
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
    if (tab === "players") renderPlayers(); else renderImport();
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
    let list = [];
    try{ list = await MF_ADMIN.list(); }catch(err){ body.querySelector(".shint:last-child").textContent = "Erreur : " + err.message; return; }
    $("mfaCount").textContent = list.length + " joueur" + (list.length > 1 ? "s" : "");
    const rows = list.map(m => `<div class="sitem"><span class="sname">${esc(m.pseudo)}<small>${m.active ? "Actif" : "En pause"} · ${new Date(m.created_at).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"})}</small></span>
      <span class="mfbtns"><button class="sbtn" data-link="${m.uid}" data-p="${esc(m.pseudo)}">Nouveau lien</button><button class="sbtn" data-act="${m.uid}" data-on="${m.active ? 0 : 1}">${m.active ? "Mettre en pause" : "Réactiver"}</button></span></div>`).join("");
    body.querySelector(".shint:last-child").outerHTML = `<p class="shint">« Nouveau lien » remplace l'ancien (qui ne marchera plus) : la collection du joueur est conservée.</p><div class="slist">${rows}</div>`;
    body.querySelectorAll("[data-link]").forEach(b => b.addEventListener("click", async () => {
      if (b.dataset.sure !== "1"){ b.dataset.sure = "1"; b.textContent = "Confirmer ?"; setTimeout(() => { b.dataset.sure = ""; b.textContent = "Nouveau lien"; }, 3000); return; }
      b.disabled = true;
      try{ const l = await MF_ADMIN.newLink(b.dataset.link); renderPlayers(linkBox(l, `Nouveau lien de <b>${b.dataset.p}</b> (l'ancien ne marche plus) :`)); }
      catch(err){ b.disabled = false; $("mfNote").innerHTML = `<p class="shint mferr">${esc(err.message)}</p>`; }
    }));
    body.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", async () => {
      b.disabled = true; try{ await MF_ADMIN.setActive(b.dataset.act, b.dataset.on === "1"); renderPlayers(); }catch(err){ b.disabled = false; }
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

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addSettingsRows); else addSettingsRows();
})();
