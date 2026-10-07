export const sk = {
  common: {
    actions: {
      back: "Späť",
      apply: "Použiť",
      cancel: "Zrušiť",
      clear: "Vymazať",
      close: "Zavrieť",
      reset: "Obnoviť",
      retry: "Skúsiť znova",
      save: "Uložiť",
    },
    or: "alebo",
    search: {
      label: "Hľadať",
    },
    enabled: "Zapnuté",
    status: {
      error: "Chyba",
      loading: "Načítava sa…",
    },
    unknown: "Neznáme",
  },
  source: {
    actions: {
      sourceActions: "Akcie zdroja",
    },
    file: {
      closeFile: "Zavrieť súbor",
      deleteFile: "Odstrániť súbor",
      open: "Otvoriť",
      openFile: "Otvoriť súbor",
      openFolder: "Otvoriť priečinok",
    },
    delete: {
      cancelled: "Odstraňovanie súboru bolo zrušené",
      failed: "Odstraňovanie súboru zlyhalo",
      interrupted: "Odstraňovanie súboru bolo prerušené",
      deleted: "Súbor bol odstránený",
      confirmation: {
        description: "Týmto odstránite {{name}} z počítača. Túto akciu možno vrátiť späť.",
        folderDescription:
          "Týmto presuniete všetky importované zdrojové súbory v priečinku {{name}} do koša. Túto akciu možno vrátiť späť.",
        folderTitle: "Odstrániť priečinok?",
        title: "Odstrániť zdrojový súbor?",
      },
      deleting: "Súbor sa odstraňuje…",
    },
    close: {
      closedFiles_one: "Zavretý {{count}} súbor",
      closedFiles_other: "Zavretých {{count}} súborov",
      closeAllSources: "Zavrieť všetky otvorené zdroje",
      confirmation: {
        description:
          "Týmto zavriete {{count}} importovaných zdrojových súborov. Úlohy vo fronte a dokončené exporty zostanú dostupné.",
        title: "Zavrieť zdroje?",
      },
    },
    restore: {
      cancelled: "Obnovenie súboru bolo zrušené",
      failed: "Obnovenie súboru zlyhalo",
      interrupted: "Obnovenie súboru bolo prerušené",
      restoring: "Súbor sa obnovuje…",
      restored: "Súbor bol obnovený",
      previousSession_one: "Obnoviť predchádzajúcu reláciu · {{count}} zdroj",
      previousSession_other: "Obnoviť predchádzajúcu reláciu · {{count}} zdrojov",
    },
    import: {
      openedFiles_one: "Otvorený {{count}} súbor",
      openedFiles_other: "Otvorených {{count}} súborov",
      fromFolders_one: "z {{count}} priečinka",
      fromFolders_other: "z {{count}} priečinkov",
    },
    reveal: {
      inFileExplorer: "Zobraziť v Prieskumníkovi súborov",
      inFileManager: "Zobraziť v správcovi súborov",
      inFinder: "Zobraziť vo Finderi",
    },
    drop: {
      action: "Pustením otvoríte video",
      description: "Otvorte jeden alebo viac podporovaných videosúborov z počítača.",
      resetNotice: "Aktuálne úpravy sa obnovia.",
      title: "Presuňte videá sem",
    },
    explorer: "Prieskumník zdrojov",
    importedSources: "Importované zdroje",
    navigation: {
      next: "Nasledujúci zdroj",
      previous: "Predchádzajúci zdroj",
    },
    search: {
      results_one: "{{count}} výsledok",
      results_few: "{{count}} výsledky",
      results_many: "{{count}} výsledkov",
      results_other: "{{count}} výsledkov",
      noResults: "Vyhľadávaniu nezodpovedajú žiadne importované zdroje.",
      shortcutLabel: "Klávesová skratka vyhľadávania zdrojov: {{shortcut}}",
    },
    metadata: {
      bitrate: "Dátový tok",
      container: "Kontajner",
      createdAt: "Vytvorené",
      duration: "Trvanie",
      fileSize: "Veľkosť súboru",
      filename: "Názov súboru",
      frameRate: "Snímková frekvencia",
      resolution: "Rozlíšenie",
      updatedAt: "Aktualizované",
      videoCodec: "Video kodek",
      accessibleLabel: "Metadáta videa",
    },
    technicalDetails: "Technické podrobnosti",
    status: {
      deleted: "Odstránené",
      missing: "Chýba",
    },
    empty: {
      description: "Vyberte súbor alebo priečinok, prípadne sem presuňte videá a začnite.",
      title: "Zatiaľ neboli importované žiadne videá",
    },
    info: {
      extensions: "MP4 · MOV · MKV · WebM · AVI",
      noSourceSelected: "Žiadny zdroj",
      previewUnavailable: "Náhľad nie je dostupný",
    },
    open: {
      fileDescription: "Vyberte jeden videosúbor a začnite upravovať.",
      folderDescription: "Importujte všetky podporované videá z priečinka.",
    },
    shortcutTooltip: "{{label}} ({{shortcut}})",
    thumbnail: {
      accessibleLabel: "Miniatúra súboru {{name}}",
    },
  },
  app: {
    brand: "EasyTrim Editor",
    navigation: {
      breadcrumb: "Navigačná cesta",
    },
    actions: {
      dismiss: "Skryť",
      copy: "Kopírovať",
    },
    window: {
      maximize: "Maximalizovať",
      minimize: "Minimalizovať",
      restart: "Reštartovať aplikáciu",
    },
    workspaceRecovery: {
      restore: "Obnoviť",
      restored_one: "Obnovený {{count}} zdroj z predchádzajúcej relácie",
      restored_other: "Obnovených {{count}} zdrojov z predchádzajúcej relácie",
      partiallyRestored: "Obnovené {{restored}} z {{total}} zdrojov z predchádzajúcej relácie",
      description_one: "EasyTrim sa neukončil normálne. Obnoviť možno {{count}} zdroj.",
      description_other: "EasyTrim sa neukončil normálne. Obnoviť možno {{count}} zdrojov.",
      title: "Obnoviť predchádzajúcu reláciu?",
      toastDescription_one: "Obnovený {{count}} zdroj",
      toastDescription_other: "Obnovených {{count}} zdrojov",
      toastPartialDescription: "Obnovené {{restored}} z {{total}} zdrojov",
      toastPartialTitle: "Predchádzajúca relácia bola čiastočne obnovená",
      toastTitle: "Predchádzajúca relácia bola obnovená",
    },
    menu: {
      file: "Súbor",
      help: "Pomocník",
    },
    version: "Verzia {{version}}",
    status: {
      checking: "Kontroluje sa…",
    },
    clipboard: {
      copied: "Skopírované do schránky",
      copyFailed: "Kopírovanie do schránky zlyhalo.",
    },
    crash: {
      description: "V aplikácii sa vyskytla neočakávaná chyba. Reštartujte ju a pokračujte.",
      title: "Vyskytla sa chyba",
    },
    dragUnavailable: "Presunutie súboru nie je dostupné: {{message}}",
    windowActionFailed: "Ovládanie okna sa nepodarilo dokončiť.",
    diagnosticsRecovery: {
      confirmation: {
        description:
          "EasyTrim sa pri poslednom spustení neukončil normálne. Diagnostické informácie z tejto relácie boli uložené a môžu pomôcť určiť príčinu.",
        revealFailed: "Diagnostickú správu sa nepodarilo zobraziť v správcovi súborov.",
        showReport: "Zobraziť správu",
        title: "EasyTrim sa neukončil normálne",
      },
    },
    shutdown: {
      confirmation: {
        description: "Fronta aktívnych exportov stále beží. Všetky neuložené úpravy sa stratia.",
        title: "Ukončiť aplikáciu počas exportu?",
      },
    },
    systemDialog: {
      confirmation: {
        description: "Pokračujte výberom umiestnenia súboru.",
        title: "Čaká sa na systémové okno",
      },
    },
    accessibility: {
      menus: "Ponuky aplikácie",
      titleBar: "Titulkový panel okna",
      windowControls: "Ovládanie okna",
    },
  },
  layout: {
    accessibility: {
      layoutControls: "Ovládanie rozloženia",
      panels: "Panely editora",
    },
    resetToDefault: "Obnoviť predvolené",
    zoomIn: "Priblížiť (+25 %)",
    zoomOut: "Oddialiť (-25 %)",
    zoomReset: "Obnoviť mierku (100 %)",
    showPanel: "Zobraziť {{panel}}",
    explorer: "Prieskumník",
    activityFeed: "Prehľad aktivít",
    bottomPanel: "Spodný panel",
    leftPanel: "Ľavý panel",
    layoutDensity: "Hustota rozloženia",
    view: "Zobraziť",
    uiScaling: "Mierka používateľského rozhrania",
    panelsVisibility: "Viditeľnosť panelov",
    customize: {
      tooltip: "Prispôsobiť rozloženie",
    },
    panelToggle: {
      tooltip: "Prepnúť {{panel}}",
    },
    density: {
      compact: "Kompaktné",
      default: "Predvolené",
    },
  },
  settings: {
    general: {
      language: {
        search: "Hľadať jazyky",
        suggestions: "Návrhy",
        noResults: "Nenašli sa žiadne jazyky.",
        description: "Vyberte jazyk používaný v EasyTrim Editore.",
        label: "Jazyk",
      },
      title: "Všeobecné",
      description: "Vyberte, ako má EasyTrim zobrazovať svoje rozhranie.",
      shortcutHint: "Dialóg nastavení môžete kedykoľvek otvoriť pomocou",
    },
    navigationLabel: "Stránky nastavení",
    appearance: {
      title: "Vzhľad",
      description: "Upravte mierku rozhrania, motív a hlavnú farbu.",
      scaling: {
        description: "Zmeňte veľkosť ovládacích prvkov a textu v aplikácii.",
      },
      primaryColor: {
        description: "Vyberte prednastavenú alebo vlastnú hlavnú farbu.",
        label: "Hlavná farba",
        pickerLabel: "Výber farby motívu",
        saturationBrightnessLabel: "Sýtosť a jas",
        hueLabel: "Odtieň",
        hexLabel: "HEX hlavnej farby",
        presets: {
          amber: "Jantárová",
          blue: "Modrá",
          emerald: "Smaragdová",
          rose: "Ružová",
          violet: "Fialová",
        },
      },
      color: {
        label: "Farba",
      },
      theme: {
        label: "Téma",
        options: {
          dark: "Tmavá",
          light: "Svetlá",
          system: "Systémová",
        },
      },
    },
    preferences: {
      title: "Predvoľby",
      sectionTitle: "Úpravy",
      description: "Vyberte predvolené správanie pre nové relácie úprav.",
      loopPlayback: {
        description: "V nových reláciách predvolene zapnúť opakovanie prehrávania.",
        label: "Opakovanie",
        commandLabel: "Predvolene zapnúť opakovanie",
      },
      followSegment: {
        description: "Predvolene obmedziť prehrávanie na vybraný segment.",
        label: "Sledovať segment",
        commandLabel: "Predvolene sledovať segment",
      },
      mergeAudio: {
        description: "Predvolene zlúčiť povolené zvukové stopy pri nových exportoch.",
        label: "Zlúčiť zvuk",
        commandLabel: "Predvolene zlúčiť zvuk",
      },
      reset: "Obnoviť nastavenia úprav",
    },
    layout: {
      title: "Rozloženie",
      description: "Nastavte viditeľnosť panelov a hustotu pracovného priestoru.",
      reset: "Obnoviť rozloženie",
      activityFeedView: {
        label: "Zobrazenie prehľadu aktivít",
        options: {
          branch: "Vetvené",
          compact: "Kompaktné",
          default: "Predvolené",
        },
      },
      panels: {
        label: "Panely",
      },
    },
    queue: {
      title: "Front",
      autoStart: {
        description: "Spustiť spracovanie hneď po pridaní exportov do frontu.",
        label: "Automatické spustenie frontu",
      },
      onFinished: {
        description: "Vyberte, čo sa stane po dokončení všetkých exportov vo fronte.",
      },
      reset: "Obnoviť nastavenia frontu",
    },
    about: {
      title: "Informácie",
      description: "Verzia aplikácie, aktualizácie a zdroje projektu.",
      more: {
        title: "Viac",
      },
      support: {
        title: "Podpora",
      },
      version: {
        description: "Zobraziť poznámky k vydaniu tejto verzie.",
      },
      updates: {
        label: "Aktualizácie",
        description: "Skontrolovať aktualizácie alebo nainštalovať dostupnú aktualizáciu.",
      },
    },
    title: "Nastavenia",
  },
  updates: {
    check: "Skontrolovať aktualizácie…",
    install: "Aktualizovať",
    checkingForUpdates: "Kontrolujú sa aktualizácie…",
    upToDate: "Aktuálna verzia",
  },
  mediaTools: {
    copyInstallCommand: "Kopírovať inštalačný príkaz FFmpeg",
    copyPath: "Kopírovať cestu k {{label}}",
    ffmpegDownloads: "Sťahovanie FFmpeg",
    recheck: "Znova skontrolovať",
    showPathInFolder: "Zobraziť {{label}} v priečinku",
    installOnWindows: "Inštalácia vo Windowse",
    title: "Multimediálne nástroje",
    status: {
      checkingTools: "Kontrolujú sa multimediálne nástroje…",
      installed: "Nainštalované",
      missing: "Nenašlo sa",
      toolsFailed: "Kontrola multimediálnych nástrojov zlyhala",
      toolsIssue: "Problém s multimediálnymi nástrojmi",
      toolsReady: "Multimediálne nástroje sú pripravené",
      toolsUnavailable: "Multimediálne nástroje nie sú dostupné",
    },
    requirements: "EasyTrim vyžaduje FFmpeg a FFprobe.",
    ready: "EasyTrim používa FFmpeg a FFprobe na kontrolu a spracovanie médií.",
    restart: "Stále sa nenašli? Po inštalácii reštartujte EasyTrim.",
    together: "FFmpeg a FFprobe sa zvyčajne dodávajú spolu.",
    locationOpenFailed: "Spustiteľný súbor sa nepodarilo zobraziť v priečinku.",
  },
  commands: {
    title: "Paleta príkazov",
    sections: {
      appearanceColor: "Vzhľad / Farba",
      appearanceTheme: "Vzhľad / Téma",
      appearanceUiScaling: "Mierka používateľského rozhrania",
      export: "Export",
      file: "Súbor",
      help: "Pomoc",
      layout: "Rozloženie",
      layoutActivityFeedView: "Rozloženie / Zobrazenie prehľadu aktivít",
      layoutDensity: "Rozloženie / Hustota",
      layoutPanelsVisibility: "Rozloženie / Viditeľnosť panelov",
      preferences: "Nastavenia",
      preferencesAudio: "Nastavenia / Zvuk",
      preferencesPlayback: "Nastavenia / Prehrávanie",
      previewFrame: "Náhľad / Snímka",
      previewTransform: "Náhľad / Transformácia",
      markers: "Značky",
      markersScene: "Značky / Scéna",
      queueOnFinishedApplication: "Front / Po dokončení / Aplikácia",
      queueOnFinishedSource: "Front / Po dokončení / Zdroj",
      go: "Prejsť",
    },
    searchLabel: "Hľadať príkazy",
    description: "Vyhľadajte akciu EasyTrim, ktorú chcete spustiť.",
    empty: "Nenašli sa žiadne príkazy.",
    placeholder: "Hľadať príkazy…",
    searchTerms: {
      closeFile: "odstrániť|zdroj",
      copyCurrentFrame: "kopírovať|snímka|obrázok|schránka",
      deleteFile: "odstrániť|kôš|zdroj",
      openFile: "importovať|video|zdroj",
      openFolder: "adresár|importovať|zdroj",
      optimizedExport: "kódovať|vykresliť|prekódovať",
      saveLosslessCut: "rýchly strih|bezstratový|vykresliť",
      saveCurrentFrame: "uložiť|snímka|obrázok|png",
    },
  },
  activity: {
    time: {
      now: "Teraz",
      today: "Dnes",
      yesterday: "Včera",
    },
    notification: {
      fileSize: "Veľkosť súboru: {{size}}",
      moreFiles: "+{{count}} ďalších súborov",
      outputPath: "Výstup: {{path}}",
      renderTime: "Čas vykresľovania: {{duration}}",
      sourcePath: "Zdroj: {{path}}",
    },
    empty: {
      description: "Dokončené akcie sa zobrazia tu.",
      title: "Zatiaľ žiadna aktivita",
    },
  },
  export: {
    fastCut: {
      cancelled: "Rýchly strih bol zrušený",
      completed: "Rýchly strih bol dokončený",
      failed: "Rýchly strih zlyhal",
      interrupted: "Rýchly strih bol prerušený",
      started: "Rýchly strih sa začal",
      cutting: "Prebieha rýchly strih…",
      actions: {
        fast: "Uložiť bez prekódovania",
      },
      messages: {
        fastUnavailable: "Strih bez prekódovania nie je dostupný po transformácii videa.",
      },
      tooltips: {
        fast: "Uložiť bez prekódovania (Ctrl+S)",
      },
    },
    render: {
      completed: "Optimalizované vykreslenie bolo dokončené",
      cancelled: "Vykreslenie bolo zrušené",
      failed: "Vykreslenie zlyhalo",
      interrupted: "Vykreslenie bolo prerušené",
      started: "Vykreslenie sa začalo",
      rendering: "Prebieha vykresľovanie…",
    },
    preset: {
      actions: {
        addPreset: "Pridať novú predvoľbu",
      },
      label: "Predvoľba",
      validation: {
        duplicate: "Názvy predvolieb musia byť jedinečné.",
        required: "Názov predvoľby je povinný.",
        tooLong: "Názov predvoľby môže mať najviac 64 znakov.",
      },
      dialog: {
        createDescription: "Uložte opakovane použiteľnú konfiguráciu FFmpeg.",
        createTitle: "Nová predvoľba",
        deleteDescription: "Odstrániť „{{name}}“? Túto akciu nemožno vrátiť späť.",
        deleteTitle: "Odstrániť predvoľbu?",
        name: "Názov",
      },
      accessibility: {
        presetActions: "Akcie predvoľby",
      },
      options: {
        selectPreset: "Vybrať predvoľbu",
      },
    },
    commandPreview: {
      actions: {
        copyCommand: "Kopírovať príkaz",
      },
      copied: "Skopírované do schránky",
      preparing: "Pripravuje sa náhľad príkazu…",
    },
    optimized: {
      actions: {
        optimized: "Optimalizovať a exportovať",
      },
      tooltips: {
        optimized: "Nastaviť a exportovať optimalizované video (Ctrl+E)",
      },
      dialog: {
        arguments: "Argumenty FFmpeg",
        description: "Pred výberom súboru nastavte optimalizované vykreslenie.",
        editTitle: "Upraviť export vo fronte",
        matchSource: "Podľa zdroja",
        saveNotice: "Po potvrdení sa otvorí systémové okno na uloženie.",
      },
    },
    general: {
      actions: {
        saveChanges: "Uložiť zmeny",
        start: "Exportovať",
      },
      labels: {
        bitrate: "Dátový tok",
        estimateSize: "Odhad veľkosti",
        estimateTime: "Odhad času",
      },
      accessibility: {
        actions: "Akcie exportu",
      },
    },
    resolution: {
      labels: {
        customScaling: "Vlastné rozlíšenie",
        height: "Výška",
        width: "Šírka",
      },
      dialog: {
        resolution: "Rozlíšenie",
      },
      options: {
        sourceResolution: "{{height}}p · {{width}} × {{height}} (zdroj)",
      },
    },
    frameRate: {
      labels: {
        fps: "FPS",
        frames: "Snímky",
      },
      dialog: {
        frameRate: "Snímková frekvencia",
      },
      options: {
        framesPerSecond: "{{value}} FPS",
      },
    },
    aspectRatio: {
      tooltip: {
        locked: "Pomer strán je uzamknutý",
        unlocked: "Pomer strán je odomknutý",
      },
      accessibility: {
        lockAspectRatio: "Uzamknúť pomer strán",
        unlockAspectRatio: "Odomknúť pomer strán",
      },
    },
  },
  queue: {
    actions: {
      cancel: "Zrušiť export",
      edit: "Upraviť export",
      open: "Otvoriť front exportov",
      restoreEdit: "Obnoviť úpravu",
      revealOutput: "Zobraziť výstup",
      retry: "Opakovať",
      start: "Spustiť front",
      skip: "Preskočiť",
    },
    deleteSource: {
      label: "Odstrániť zdroj",
      tooltip: "Po úspešnom vykreslení odstráni zdroj",
      confirmation: {
        description:
          "Pôvodný zdrojový súbor sa po úspešnom dokončení vykreslenia odstráni. Túto akciu možno vrátiť späť.",
        title: "Odstrániť zdroj po vykreslení?",
      },
    },
    onFinished: {
      label: "Po dokončení frontu",
      shortOptions: {
        exit: "Ukončiť",
      },
      options: {
        exit: "Ukončiť aplikáciu",
        nothing: "Nevykonať nič",
        systemShutdown: "Vypnúť systém",
        systemSleep: "Uspať systém",
      },
    },
    exportQueueTitle: "Front exportov",
    routes: {
      fastCut: "Rýchly strih",
      optimized: "Optimalizované",
    },
    title: "Front",
    jobStatus: {
      canceled: "Zrušené",
      completed: "Dokončené",
      failed: "Zlyhalo",
      queued: "Vo fronte",
      rendering: "Vykresľuje sa…",
    },
    empty: {
      description: "Exporty sa zobrazia tu.",
    },
    summary: {
      canceled_one: "{{count}} zrušený",
      canceled_other: "{{count}} zrušených",
      completed_one: "{{count}} dokončený",
      completed_other: "{{count}} dokončených",
      failed_one: "{{count}} zlyhaný",
      failed_other: "{{count}} zlyhaných",
      jobs_one: "{{count}} úloha",
      jobs_other: "{{count}} úloh",
      queued_one: "{{count}} vo fronte",
      queued_other: "{{count}} vo fronte",
      rendering_one: "{{count}} sa vykresľuje",
      rendering_other: "{{count}} sa vykresľuje",
    },
    metrics: {
      elapsed: "{{value}} uplynulo",
      error: "Chyba exportu: {{message}}",
      fileSizeChange: "Zmena veľkosti súboru: {{value}}",
      fps: "{{value}} FPS",
      remaining: "zostáva {{value}}",
      durationTooltip: "Trvanie exportu",
      fileSizeTooltip: "Veľkosť výstupného súboru",
      fileSizeChangeTooltip: "Zmena veľkosti súboru oproti zdroju",
      fpsTooltip: "Počet vykreslených snímok za sekundu",
      remainingTooltip: "Odhadovaný zostávajúci čas",
    },
    progress: {
      tooltip: "Priebeh exportu",
      accessibleLabel: "Priebeh exportu",
    },
  },
  preview: {
    frame: {
      nextFrame: "Nasledujúca snímka",
      copyFrame: "Kopírovať snímku",
      previousFrame: "Predchádzajúca snímka",
      saveFrame: "Uložiť snímku",
      frameCopied: "Snímka bola skopírovaná do schránky",
      frameCopyFailed: "Snímku sa nepodarilo skopírovať do schránky.",
      frameSaveFailed: "Snímku sa nepodarilo uložiť.",
      frameSaved: "Snímka bola uložená",
      nextFrameTooltip: "Nasledujúca snímka (šípka doprava; podržaním prehrať 2×)",
      previousFrameTooltip: "Predchádzajúca snímka (šípka doľava; podržaním pretočiť späť 2×)",
    },
    markers: {
      nextMarker: "Nasledujúca značka",
      previousMarker: "Predchádzajúca značka",
    },
    playback: {
      pause: "Pozastaviť",
      play: "Prehrať",
      loopPlayback: "Opakovať prehrávanie",
      playbackVolume: "Hlasitosť prehrávania",
      playbackSpeed: "Rýchlosť prehrávania",
      segmentPlayback: "Prehrávanie segmentu",
      playbackFailed: "Prehrávanie sa nepodarilo spustiť.",
      loopDisabledTooltip: "Po dosiahnutí konca sa prehrávanie zastaví",
      loopEnabledTooltip: "Po dosiahnutí konca sa prehrávanie reštartuje",
      pauseTooltip: "Pozastaviť (medzerník)",
      playTooltip: "Prehrať (medzerník)",
      playbackSpeedTooltip: "Upraviť rýchlosť prehrávania náhľadu",
      playbackVolumeMuteTooltip: "Hlasitosť prehrávania (Stlmiť)",
      playbackVolumeUnmuteTooltip: "Hlasitosť prehrávania (Zrušiť stlmenie)",
    },
    segment: {
      setEnd: "Nastaviť koniec segmentu na aktuálnu pozíciu",
      setStart: "Nastaviť začiatok segmentu na aktuálnu pozíciu",
      setEndUnavailable: "Koniec segmentu nastavíte presunutím za začiatok zdroja",
      setStartUnavailable: "Začiatok segmentu nastavíte presunutím pred koniec zdroja",
      segmentDisabledTooltip: "Prehráva sa celá časová os",
      segmentEnabledTooltip: "Prehrávanie je obmedzené na vybraný segment",
      setEndTooltip: "Nastaviť koniec segmentu na aktuálnu pozíciu (O)",
      setStartTooltip: "Nastaviť začiatok segmentu na aktuálnu pozíciu (I)",
    },
    transform: {
      crop: "Orezať",
      flipHorizontal: "Prevrátiť vodorovne",
      flipVertical: "Prevrátiť zvisle",
      rotate180: "Otočiť o 180°",
      rotate90Clockwise: "Otočiť o 90° vpravo",
      rotate90Counterclockwise: "Otočiť o 90° vľavo",
      reset: "Obnoviť predvolené",
      cropTooltip: "Kliknite pravým tlačidlom na náhľad pre transformácie",
      resetConfirmation: {
        description: "Týmto sa obnoví orezanie, otočenie a prevrátenie aktuálneho videa.",
        title: "Obnoviť transformácie videa?",
      },
    },
    info: {
      compatible: "Kompatibilný náhľad",
      transform: "Transformácia",
      playbackError: "Náhľad videa sa nepodarilo zobraziť",
      proxy:
        "Pôvodný zdroj nebolo možné prehrať priamo, preto EasyTrim pripravil kompatibilný náhľad, ktorý môže mať nižšiu kvalitu. Export stále používa pôvodný súbor.",
    },
    shortcuts: {
      markInOut: "Začiatok / Koniec",
      playPause: "Prehrať / Pauza",
      previousNextFrame: "Pred. / Nasl. snímka",
      title: "Klávesové skratky",
    },
    loading: {
      opening: "Otvára sa náhľad…",
      preparing: "Pripravuje sa kompatibilný náhľad…",
    },
    accessibility: {
      controls: "Ovládanie prehrávania náhľadu",
      currentTime: "Aktuálny čas prehrávania",
      empty: "Prázdny náhľad",
      source: "Náhľad zdrojového videa",
    },
    crop: {
      bottom: "Zmeniť orezanie odspodu",
      bottomLeft: "Zmeniť orezanie zľava odspodu",
      bottomRight: "Zmeniť orezanie sprava odspodu",
      left: "Zmeniť orezanie zľava",
      preview: "Náhľad orezania videa",
      right: "Zmeniť orezanie sprava",
      top: "Zmeniť orezanie zhora",
      topLeft: "Zmeniť orezanie zľava zhora",
      topRight: "Zmeniť orezanie sprava zhora",
    },
  },
  timeline: {
    sceneMarkers: {
      actions: {
        detectScenes: "Rozpoznať zmeny scén",
        disableSceneMarkers: "Skryť značky scén",
        enableSceneMarkers: "Zobraziť značky scén",
      },
      status: {
        sceneDetectionFailed: "Rozpoznávanie scén zlyhalo. Skúste to znova.",
      },
      tooltips: {
        detectScenes:
          "Analyzovať zdrojové video a vyhľadať zmeny scén. Podržte Shift počas ťahania a prichyťte sa k značke scény alebo k okraju rozsahu aktivity zvuku.",
      },
    },
    segment: {
      actions: {
        moveSegment: "Presunúť vybraný segment",
      },
      labels: {
        end: "Koniec",
        selectedSegment: "Vybraný segment",
        start: "Začiatok",
      },
      tooltips: {
        moveSegment: "Potiahnutím presuňte vybraný segment — podržaním Shift ho prichytíte",
        trimReset: "{{label}} — podržaním Shift prichytíte — dvojitým kliknutím obnovíte",
      },
      accessibility: {
        trimEnd: "Koniec strihu",
        trimStart: "Začiatok strihu",
        trimValues: "Časové hodnoty strihu",
      },
    },
    playhead: {
      labels: {
        duration: "Trvanie",
        tools: "Nástroje",
      },
      accessibility: {
        playbackPosition: "Pozícia prehrávania",
        seconds: "{{value}} sekundy",
        startsAt: "Začína v čase {{time}}",
        tools: "Nástroje časovej osi videa",
        track: "Časová os strihu videa",
      },
    },
    audioMeter: {
      accessibility: {
        audioLevel: "Úroveň stereo zvuku",
        leftAudioChannelLevel: "Úroveň zvuku ľavého kanála",
        rightAudioChannelLevel: "Úroveň zvuku pravého kanála",
      },
    },
  },
  audio: {
    loudness: {
      actions: {
        analyzeLoudness: "Analyzovať hlasitosť",
        analyzingLoudness: "Analyzuje sa hlasitosť…",
      },
    },
    activityDetection: {
      actions: {
        analyzeActivity: "Analyzovať aktivitu zvuku",
        analyzingActivity: "Analyzuje sa aktivita zvuku…",
        retryActivityDetection: "Zopakovať analýzu",
        showActivity: "Zobraziť rozpoznané úseky",
      },
    },
    effects: {
      open: "Efekty",
      labels: {
        effectStageCleanup: "Čistenie",
        effectStageDynamics: "Dynamika",
        effectStageLevel: "Úroveň",
        effectStageProtection: "Ochrana",
      },
      dialog: {
        applyNotice: "Zmeny sa nepoužijú, kým nevyberiete možnosť Použiť.",
        description: "Efekty sa aplikujú v pevnom poradí zobrazenom v zozname.",
        title: "{{title}} — efekty",
      },
      accessibility: {
        appliedEffects: "Použité efekty: {{summary}}",
      },
    },
    output: {
      actions: {
        merge: "Zlúčiť vybrané stopy",
      },
      messages: {
        merged_one: "{{count}} vybraná stopa sa zlúči do jednej stopy",
        merged_few: "{{count}} vybrané stopy sa zlúčia do jednej stopy",
        merged_other: "{{count}} vybraných stôp sa zlúči do jednej stopy",
        oneTrack: "Jedna vybraná stopa — zlúčenie nie je potrebné",
        separate_one: "{{count}} vybraná stopa zostane samostatná",
        separate_few: "{{count}} vybrané stopy zostanú samostatné",
        separate_other: "{{count}} vybraných stôp zostane samostatných",
        videoOnly: "Výstup iba s videom",
      },
      tooltips: {
        merge: "Všetky vybrané stopy sa zlúčia do jednej stopy; vyžaduje si to kódovanie.",
      },
    },
    tracks: {
      actions: {
        mute: "Stlmiť",
        muteTrack: "Stlmiť ({{title}})",
        unmute: "Zrušiť stlmenie",
        unmuteTrack: "Zrušiť stlmenie ({{title}})",
      },
      labels: {
        advanced: "Rozšírené",
        defaultTrack: "Zvuk {{number}}",
      },
      title: "Zvukové stopy",
      messages: {
        preparingProcessedPreview: "Pripravuje sa náhľad s týmito nastaveniami stopy…",
      },
      accessibility: {
        trackActions: "Akcie zvukovej stopy {{number}}",
        trackGain: "Zosilnenie zvukovej stopy {{number}} v decibeloch",
      },
      options: {
        channels_one: "{{count}} kanál",
        channels_few: "{{count}} kanály",
        channels_other: "{{count}} kanálov",
        unknownLayout: "neznáme rozloženie",
      },
    },
    highPass: {
      label: "Hornopriepustný filter",
      labelCutoff: "Hraničná frekvencia",
      description: "Odstráňte nízkofrekvenčné dunenie z tejto stopy.",
      messages: {
        highPassEffectSummary: "Hornopriepustný filter ({{cutoff}} Hz)",
      },
    },
    limiter: {
      label: "Obmedzovač špičiek",
      labelCeiling: "Výstupný limit",
      description: "Znížiť špičky tejto stopy.",
      messages: {
        limitedEffectSummary: "Obmedzovač špičiek ({{ceiling}} dB)",
      },
    },
    normalization: {
      labels: {
        loudnessNormalization: "Normalizácia hlasitosti",
        maximumTruePeak: "Maximálny skutočný vrchol (dBTP)",
        targetLufs: "Cieľová hlasitosť (LUFS)",
      },
      labelPreset: "Predvoľba",
      messages: {
        loudnessNormalizationDescription: "Normalizovať túto stopu na cieľovú hlasitosť.",
        normalizedEffectSummary: "Normalizované - {{preset}}",
        normalizedLevelSummary: "Cieľ {{target}} LUFS · limit špičky {{peak}} dBTP",
      },
      tooltips: {
        normalizationReplacesGain:
          "Manuálne zosilnenie nie je dostupné, keď je aktívna automatická normalizácia.",
      },
      options: {
        custom: "Vlastné",
        webVideo: "Webové video",
        streaming: "Streamovanie",
        broadcast: "Vysielanie",
      },
    },
    noiseReduction: {
      label: "Redukcia šumu",
      labelStrength: "Sila redukcie šumu",
      description: "Obmedziť šum v pozadí tejto zvukovej stopy.",
      messages: {
        noiseReductionEffectSummary: "Redukcia šumu - {{preset}}",
      },
      options: {
        light: "Jemná",
        medium: "Stredná",
        strong: "Silná",
      },
    },
    waveform: {
      status: {
        preparingWaveform: "Pripravuje sa priebeh zvuku…",
        waveformUnavailable: "Priebeh zvuku nie je dostupný",
      },
    },
  },
  support: {
    changelog: {
      actions: {
        changelog: "Zoznam zmien",
      },
      labels: {
        added: "Pridané",
        changed: "Zmenené",
        deprecated: "Zastarané",
        fixed: "Opravené",
        removed: "Odstránené",
        security: "Bezpečnosť",
        historyTitle: "Zoznam zmien",
      },
      messages: {
        emptyChangelog: "Zatiaľ nie sú dostupné žiadne vydané zmeny.",
        emptyChangelogDescription:
          "Vydané aktualizácie sa tu zobrazia, keď budú súčasťou nainštalovanej verzie.",
        historyDescription: "Vydané zmeny zahrnuté v tejto verzii EasyTrim.",
      },
    },
    project: {
      actions: {
        koFi: "Podporte na Ko-fi.com",
        projectPage: "Stránka projektu",
        projectSupport: "Podporte projekt",
        showLogs: "Zobraziť záznamy",
        viewOnGitHub: "Zobraziť na GitHube",
      },
      messages: {
        buyMeCoffee: "Kúpte mi kávu",
      },
    },
    whatsNew: {
      labels: {
        whatsNewTitle: "Čo je nové",
      },
      messages: {
        whatsNewDescription: "Tu sú zmeny od vášho posledného otvorenia EasyTrim.",
      },
    },
  },
  units: {
    framesPerSecond: "{{value}} fps",
    megabitsPerSecond: "{{value}} Mb/s",
  },
} as const;
