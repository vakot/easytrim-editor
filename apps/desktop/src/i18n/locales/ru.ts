export const ru = {
  common: {
    actions: {
      back: "Назад",
      apply: "Применить",
      cancel: "Отмена",
      clear: "Очистить",
      close: "Закрыть",
      reset: "Сбросить",
      retry: "Повторить",
      save: "Сохранить",
      resetToDefault: "Сбросить настройки",
    },
    or: "или",
    search: {
      label: "Поиск",
    },
    enabled: "Включено",
    status: {
      error: "Ошибка",
      loading: "Загрузка…",
    },
    unknown: "Неизвестно",
  },
  source: {
    actions: {
      title: "Действия с источником",
    },
    file: {
      closeFile: "Закрыть файл",
      deleteFile: "Удалить файл",
      open: "Открыть",
      openFile: "Открыть файл",
      openFolder: "Открыть папку",
    },
    delete: {
      cancelled: "Удаление файла отменено",
      failed: "Не удалось удалить файл",
      interrupted: "Удаление файла прервано",
      completed: "Файл удалён",
      confirmation: {
        description: "Файл {{name}} будет удалён с компьютера. Это действие можно отменить.",
        folderDescription:
          "Все импортированные исходные файлы в папке {{name}} будут перемещены в корзину. Это действие можно отменить.",
        folderTitle: "Удалить папку?",
        title: "Удалить файл источника?",
      },
      deleting: "Удаление файла…",
    },
    close: {
      closeAllSources: "Закрыть все открытые источники",
      confirmation: {
        description:
          "Будет закрыто импортированных файлов: {{count}}. Экспорты в очереди и завершённые экспорты останутся доступными.",
        title: "Закрыть источники?",
      },
    },
    restore: {
      cancelled: "Восстановление файла отменено",
      failed: "Не удалось восстановить файл",
      interrupted: "Восстановление файла прервано",
      restoring: "Восстановление файла…",
      completed: "Файл восстановлен",
    },
    reveal: {
      inFileExplorer: "Показать в Проводнике",
      inFileManager: "Показать в файловом менеджере",
      inFinder: "Показать в Finder",
    },
    drop: {
      action: "Перетащите видео, чтобы открыть",
      description: "Откройте один или несколько поддерживаемых видеофайлов с компьютера.",
      resetNotice: "Текущий монтаж будет сброшен.",
      title: "Перетащите видео сюда",
    },
    explorer: "Проводник",
    importedSources: "Импортированные источники",
    navigation: {
      next: "Следующий источник",
      previous: "Предыдущий источник",
    },
    search: {
      results_one: "{{count}} результат",
      results_few: "{{count}} результата",
      results_many: "{{count}} результатов",
      results_other: "{{count}} результата",
      noResults: "Нет импортированных источников, соответствующих поиску.",
      shortcutLabel: "Сочетание клавиш для поиска источников: {{shortcut}}",
    },
    metadata: {
      bitrate: "Битрейт",
      container: "Контейнер",
      createdAt: "Дата создания",
      duration: "Длительность",
      fileSize: "Размер файла",
      filename: "Имя файла",
      frameRate: "Частота кадров",
      resolution: "Разрешение",
      updatedAt: "Дата изменения",
      videoCodec: "Видеокодек",
      accessibleLabel: "Метаданные видео",
    },
    technicalDetails: "Технические сведения",
    status: {
      deleted: "Удалено",
      missing: "Отсутствуют",
    },
    empty: {
      description: "Выберите файл или папку либо перетащите видео сюда, чтобы начать.",
      title: "Видео ещё не импортированы",
    },
    info: {
      extensions: "MP4 · MOV · MKV · WebM · AVI",
      noSourceSelected: "Нет источника",
      previewUnavailable: "Предпросмотр недоступен",
    },
    open: {
      fileDescription: "Выберите один видеофайл, чтобы начать монтаж.",
      folderDescription: "Импортируйте все поддерживаемые видео из папки.",
    },
    shortcutTooltip: "{{label}} ({{shortcut}})",
    thumbnail: {
      accessibleLabel: "Миниатюра файла {{name}}",
    },
  },
  app: {
    brand: "EasyTrim Editor",
    navigation: {
      breadcrumb: "Хлебные крошки",
    },
    actions: {
      dismiss: "Скрыть",
      copy: "Копировать",
    },
    window: {
      maximize: "Развернуть",
      minimize: "Свернуть",
      restart: "Перезапустить приложение",
    },
    workspaceRecovery: {
      restore: "Восстановить",
      partiallyRestored: "Восстановлено {{restored}} из {{total}} источников из предыдущего сеанса",
      title: "Восстановить предыдущий сеанс?",
      toastPartialDescription: "Восстановлено {{restored}} из {{total}} источников",
      toastPartialTitle: "Предыдущий сеанс восстановлен частично",
      toastTitle: "Предыдущий сеанс восстановлен",
    },
    menu: {
      file: "Файл",
      help: "Справка",
    },
    version: "Версия {{version}}",
    status: {
      checking: "Проверка…",
    },
    clipboard: {
      copied: "Скопировано",
      copyFailed: "Не удалось скопировать в буфер обмена.",
    },
    crash: {
      description:
        "В приложении произошла непредвиденная ошибка. Перезапустите его, чтобы продолжить.",
      title: "Что-то пошло не так",
    },
    dragUnavailable: "Перетаскивание недоступно: {{message}}",
    windowActionFailed: "Не удалось выполнить действие с окном.",
    diagnosticsRecovery: {
      confirmation: {
        description:
          "В прошлый раз EasyTrim завершил работу некорректно. Диагностическая информация этой сессии была сохранена и может помочь определить причину.",
        revealFailed: "Не удалось показать диагностический отчёт в файловом менеджере.",
        showReport: "Показать отчёт",
        title: "EasyTrim завершил работу некорректно",
      },
    },
    shutdown: {
      confirmation: {
        description:
          "Активная очередь экспорта всё ещё выполняется. Все несохранённые данные монтажа будут потеряны.",
        title: "Выйти во время экспорта?",
      },
    },
    systemDialog: {
      confirmation: {
        description: "Выберите расположение файла, чтобы продолжить.",
        title: "Ожидание системного диалога",
      },
    },
    accessibility: {
      menus: "Меню приложения",
      titleBar: "Панель заголовка окна",
      windowControls: "Управление окном",
    },
  },
  layout: {
    accessibility: {
      layoutControls: "Управление расположением",
      panels: "Панели редактора",
    },
    zoomIn: "Увеличить масштаб (+25%)",
    zoomOut: "Уменьшить масштаб (-25%)",
    zoomReset: "Сбросить масштаб (100%)",
    showPanel: "Показать: {{panel}}",
    explorer: "Проводник",
    activityFeed: "Лента активности",
    bottomPanel: "Нижняя панель",
    leftPanel: "Левая панель",
    layoutDensity: "Плотность расположения",
    view: "Вид",
    uiScaling: "Масштаб интерфейса",
    panelsVisibility: "Видимость панелей",
    customize: {
      tooltip: "Настроить расположение",
    },
    panelToggle: {
      tooltip: "Переключить {{panel}}",
    },
    density: {
      compact: "Компактная",
      default: "Обычная",
    },
  },
  settings: {
    general: {
      language: {
        search: "Поиск языков",
        suggestions: "Предложения",
        noResults: "Языки не найдены.",
        description: "Выберите язык интерфейса EasyTrim Editor.",
        label: "Язык",
      },
      title: "Общие",
      description: "Выберите, как EasyTrim отображает интерфейс.",
      shortcutHint: "Открыть окно настроек можно в любое время сочетанием",
    },
    navigationLabel: "Разделы настроек",
    appearance: {
      title: "Внешний вид",
      description: "Настройте масштаб интерфейса, тему и основной цвет.",
      scaling: {
        description: "Измените размер элементов управления и текста в приложении.",
      },
      primaryColor: {
        description: "Выберите готовый или пользовательский основной цвет.",
        label: "Основной цвет",
        pickerLabel: "Выбор цвета темы",
        saturationBrightnessLabel: "Насыщенность и яркость",
        hueLabel: "Оттенок",
        hexLabel: "HEX основного цвета",
        presets: {
          amber: "Янтарный",
          blue: "Синий",
          emerald: "Изумрудный",
          rose: "Розовый",
          violet: "Фиолетовый",
        },
      },
      color: {
        label: "Цвет",
      },
      theme: {
        label: "Тема",
        options: {
          dark: "Тёмная",
          light: "Светлая",
          system: "Системная",
        },
      },
    },
    preferences: {
      title: "Предпочтения",
      editing: {
        title: "Редактирование",
      },
      description: "Выберите поведение по умолчанию для новых сеансов редактирования.",
      loopPlayback: {
        description: "Включать повтор воспроизведения для новых сеансов.",
        label: "Повтор",
        commandLabel: "Включать повтор по умолчанию",
      },
      followSegment: {
        description: "По умолчанию ограничивать воспроизведение выбранным сегментом.",
        label: "Следовать за сегментом",
        commandLabel: "Следовать за сегментом по умолчанию",
      },
      mergeAudio: {
        description: "Объединять включённые аудиодорожки в новых экспортах.",
        label: "Объединять аудио",
        commandLabel: "Объединять аудио по умолчанию",
      },
      reset: "Сбросить настройки редактирования",
    },
    layout: {
      title: "Макет",
      description: "Настройте видимость панелей и плотность рабочей области.",
      reset: "Сбросить макет",
      activityFeedView: {
        label: "Вид ленты активности",
        options: {
          branch: "Ветвление",
          compact: "Компактный",
          default: "Обычный",
        },
      },
      panels: {
        label: "Панели",
      },
    },
    queue: {
      title: "Очередь",
      autoStart: {
        description: "Начинать обработку сразу после добавления экспортов в очередь.",
        label: "Автозапуск очереди",
      },
      onFinished: {
        description: "Выберите действие после завершения всех экспортов в очереди.",
      },
      reset: "Сбросить настройки очереди",
    },
    about: {
      title: "О программе",
      description: "Версия приложения, обновления и ресурсы проекта.",
      more: {
        title: "Дополнительно",
      },
      support: {
        title: "Поддержка",
      },
      version: {
        description: "Открыть заметки к выпуску этой версии.",
      },
      updates: {
        label: "Обновления",
        description: "Проверить наличие обновлений или установить доступное обновление.",
      },
    },
    title: "Настройки",
  },
  updates: {
    check: "Проверить обновления…",
    install: "Обновить",
    checkingForUpdates: "Проверка обновлений…",
    upToDate: "Обновлений нет",
  },
  mediaTools: {
    copyInstallCommand: "Копировать команду установки FFmpeg",
    copyPath: "Копировать путь к {{label}}",
    ffmpegDownloads: "Загрузки FFmpeg",
    recheck: "Проверить снова",
    showPathInFolder: "Показать {{label}} в папке",
    installOnWindows: "Установка в Windows",
    title: "Медиатулы",
    status: {
      checkingTools: "Проверка медиатулов…",
      installed: "Установлено",
      missing: "Не найдено",
      toolsFailed: "Не удалось проверить медиатулы",
      toolsIssue: "Проблема с медиатулами",
      toolsReady: "Медиатулы готовы",
      toolsUnavailable: "Медиатулы недоступны",
    },
    requirements: "EasyTrim требуется FFmpeg и FFprobe.",
    ready: "EasyTrim использует FFmpeg и FFprobe для проверки и обработки медиа.",
    restart: "Всё ещё не найдено? Перезапустите EasyTrim после установки.",
    together: "FFmpeg и FFprobe обычно поставляются вместе.",
    locationOpenFailed: "Не удалось показать исполняемый файл в папке.",
  },
  commands: {
    title: "Палитра команд",
    sections: {
      appearanceColor: "Внешний вид / Цвет",
      appearanceTheme: "Внешний вид / Тема",
      appearanceUiScaling: "Масштаб интерфейса",
      export: "Экспорт",
      file: "Файл",
      help: "Справка",
      layout: "Макет",
      layoutActivityFeedView: "Макет / Вид ленты активности",
      layoutDensity: "Макет / Плотность",
      layoutPanelsVisibility: "Макет / Видимость панелей",
      preferences: "Параметры",
      preferencesAudio: "Параметры / Аудио",
      preferencesPlayback: "Параметры / Воспроизведение",
      previewFrame: "Предпросмотр / Кадр",
      previewTransform: "Предпросмотр / Трансформация",
      markers: "Маркеры",
      markersScene: "Маркеры / Сцена",
      queueOnFinishedApplication: "Очередь / После завершения / Приложение",
      queueOnFinishedSource: "Очередь / После завершения / Источник",
      go: "Перейти",
    },
    searchLabel: "Поиск команд",
    description: "Найдите действие EasyTrim, которое нужно выполнить.",
    empty: "Команды не найдены.",
    placeholder: "Поиск команд…",
    searchTerms: {
      closeFile: "убрать|источник",
      copyCurrentFrame: "копировать|кадр|изображение|буфер обмена",
      deleteFile: "удалить|корзина|источник",
      openFile: "импорт|видео|источник",
      openFolder: "каталог|импорт|источник",
      optimizedExport: "кодировать|рендер|перекодировать",
      saveLosslessCut: "быстрая обрезка|без потерь|рендер",
      saveCurrentFrame: "сохранить|кадр|изображение|png",
    },
  },
  activity: {
    time: {
      now: "Сейчас",
      today: "Сегодня",
      yesterday: "Вчера",
    },
    notification: {
      fileSize: "Размер файла: {{size}}",
      moreFiles: "+{{count}} ещё",
      outputPath: "Путь вывода: {{path}}",
      renderTime: "Время рендеринга: {{duration}}",
      sourcePath: "Путь источника: {{path}}",
    },
    empty: {
      description: "Завершённые действия появятся здесь.",
      title: "Активности пока нет",
    },
  },
  export: {
    fastCut: {
      cancelled: "Быстрая нарезка отменена",
      completed: "Быстрая нарезка завершена",
      failed: "Быстрая нарезка не удалась",
      interrupted: "Быстрая нарезка прервана",
      started: "Начата быстрая нарезка",
      cutting: "Быстрая нарезка…",
      action: "Быстрое сохранение",
      unavailable: "Сохранение без перекодирования недоступно после преобразования видео.",
      tooltip: "Сохранить без перекодирования (Ctrl+S)",
    },
    render: {
      completed: "Оптимизированный рендеринг завершён",
      cancelled: "Рендеринг отменён",
      failed: "Рендеринг не удался",
      interrupted: "Рендеринг прерван",
      started: "Рендеринг начат",
      rendering: "Рендеринг…",
    },
    preset: {
      actions: {
        add: "Добавить пресет",
      },
      label: "Пресет",
      validation: {
        duplicate: "Имена пресетов должны быть уникальными.",
        required: "Введите имя пресета.",
        tooLong: "Имя пресета не может содержать более 64 символов.",
      },
      create: {
        description: "Сохранить конфигурацию FFmpeg для повторного использования.",
        title: "Новый пресет",
      },
      delete: {
        description: "Удалить «{{name}}»? Это действие нельзя отменить.",
        title: "Удалить пресет?",
      },
      nameLabel: "Имя",
      actionsLabel: "Действия с пресетом",
      selectPlaceholder: "Выберите пресет",
    },
    commandPreview: {
      copy: "Копировать команду",
      copied: "Команда скопирована",
      preparing: "Подготовка предпросмотра команды…",
    },
    optimized: {
      action: "Оптимизированный экспорт",
      tooltip: "Настроить и экспортировать оптимизированное видео (Ctrl+E)",
      dialog: {
        arguments: "Аргументы FFmpeg",
        description: "Настройте оптимизированный рендеринг перед выбором файла.",
        editTitle: "Изменить экспорт в очереди",
        matchSource: "Как у источника",
        saveNotice: "После подтверждения откроется системный диалог сохранения.",
      },
    },
    actions: {
      saveChanges: "Сохранить изменения",
      start: "Экспортировать",
      accessibleLabel: "Действия экспорта",
    },
    bitrate: {
      label: "Битрейт",
    },
    estimate: {
      sizeLabel: "Оценить размер",
      timeLabel: "Оценить время",
    },
    resolution: {
      customScaling: "Пользовательское масштабирование",
      heightLabel: "Высота",
      widthLabel: "Ширина",
      label: "Разрешение",
      sourceOption: "{{height}}p · {{width}} × {{height}} (источник)",
    },
    frameRate: {
      fpsLabel: "FPS",
      framesLabel: "Кадры",
      label: "Частота кадров",
      value: "{{value}} FPS",
    },
    aspectRatio: {
      lockedTooltip: "Соотношение сторон заблокировано",
      unlockedTooltip: "Соотношение сторон разблокировано",
      lockLabel: "Заблокировать соотношение сторон",
      unlockLabel: "Разблокировать соотношение сторон",
    },
  },
  queue: {
    actions: {
      cancelExport: "Отменить экспорт",
      editExport: "Изменить экспорт",
      openExportQueue: "Открыть очередь экспорта",
      restoreEdit: "Восстановить монтаж",
      revealOutput: "Показать результат",
      retryExport: "Повторить",
      startQueue: "Запустить очередь",
      skipExport: "Пропустить",
    },
    deleteSource: {
      label: "Удалить источник",
      tooltip: "Удалить источник после успешного рендеринга",
      confirmation: {
        description:
          "Исходный файл будет удалён после успешного завершения рендеринга. Это действие можно отменить.",
        title: "Удалить источник после рендеринга?",
      },
    },
    onFinished: {
      label: "После завершения очереди",
      shortOptions: {
        exit: "Выйти",
      },
      options: {
        exit: "Закрыть приложение",
        nothing: "Ничего не делать",
        systemShutdown: "Выключить систему",
        systemSleep: "Перевести систему в спящий режим",
      },
    },
    exportQueueTitle: "Очередь экспорта",
    routes: {
      fastCut: "Быстрая нарезка",
      optimized: "Оптимизированный",
    },
    title: "Очередь",
    jobStatus: {
      canceled: "Отменено",
      completed: "Завершено",
      failed: "Ошибка",
      queued: "В очереди",
      rendering: "Рендеринг…",
    },
    empty: {
      description: "Экспорты появятся здесь.",
    },
    metrics: {
      elapsed: "{{value}} прошло",
      error: "Ошибка экспорта: {{message}}",
      fileSizeChange: "Изменение размера файла: {{value}}",
      fps: "{{value}} FPS",
      remaining: "осталось {{value}}",
      durationTooltip: "Длительность экспорта",
      fileSizeTooltip: "Размер выходного файла",
      fileSizeChangeTooltip: "Изменение размера файла относительно источника",
      fpsTooltip: "Количество обработанных кадров в секунду",
      remainingTooltip: "Оставшееся время (оценка)",
    },
    progress: {
      tooltip: "Ход экспорта",
      accessibleLabel: "Прогресс экспорта",
    },
  },
  preview: {
    frame: {
      next: "Следующий кадр",
      copyFrame: "Скопировать кадр",
      previous: "Предыдущий кадр",
      saveFrame: "Сохранить кадр",
      copied: "Кадр скопирован в буфер обмена",
      copyFailed: "Не удалось скопировать кадр в буфер обмена.",
      saveFailed: "Не удалось сохранить кадр.",
      saved: "Кадр сохранён",
      nextFrameTooltip: "Следующий кадр (правая стрелка; удерживайте для воспроизведения в 2×)",
      previousFrameTooltip: "Предыдущий кадр (левая стрелка; удерживайте для перемотки в 2×)",
    },
    markers: {
      next: "Следующий маркер",
      previous: "Предыдущий маркер",
    },
    playback: {
      pause: "Пауза",
      play: "Воспроизвести",
      loopPlayback: "Повтор воспроизведения",
      volume: "Громкость воспроизведения",
      speed: "Скорость воспроизведения",
      segmentPlayback: "Воспроизведение сегмента",
      failed: "Не удалось начать воспроизведение.",
      loopDisabledTooltip: "Остановиться в конце воспроизведения",
      loopEnabledTooltip: "Начать заново после окончания",
      pauseTooltip: "Пауза (Пробел)",
      playTooltip: "Воспроизвести (Пробел)",
      playbackSpeedTooltip: "Настроить скорость предпросмотра",
      playbackVolumeMuteTooltip: "Громкость воспроизведения (Выключить звук)",
      playbackVolumeUnmuteTooltip: "Громкость воспроизведения (Включить звук)",
    },
    segment: {
      setEnd: "Установить конец сегмента в текущей позиции",
      setStart: "Установить начало сегмента в текущей позиции",
      setEndUnavailable: "Переместитесь после начала источника, чтобы установить конец сегмента",
      setStartUnavailable: "Переместитесь до конца источника, чтобы установить начало сегмента",
      segmentDisabledTooltip: "Воспроизводить всю временную шкалу",
      segmentEnabledTooltip: "Ограничить воспроизведение выбранным сегментом",
      setEndTooltip: "Установить конец сегмента в текущей позиции (O)",
      setStartTooltip: "Установить начало сегмента в текущей позиции (I)",
    },
    transform: {
      crop: "Обрезка",
      flipHorizontal: "Отразить по горизонтали",
      flipVertical: "Отразить по вертикали",
      rotate180: "Повернуть на 180°",
      rotate90Clockwise: "Повернуть на 90° по часовой стрелке",
      rotate90Counterclockwise: "Повернуть на 90° против часовой стрелки",
      cropTooltip: "Щёлкните правой кнопкой по предпросмотру, чтобы изменить видео",
      resetConfirmation: {
        description: "Сбросить обрезку, поворот и отражения текущего видео.",
        title: "Сбросить преобразования видео?",
      },
      title: "Преобразование",
    },
    info: {
      compatible: "Совместимый предпросмотр",
      playbackError: "Не удалось просмотреть это видео",
      proxy:
        "Исходный файл нельзя воспроизвести напрямую, поэтому EasyTrim подготовил совместимый прокси-файл с возможным снижением качества. Для экспорта используется исходный файл.",
    },
    shortcuts: {
      markInOut: "Начало / Конец",
      playPause: "Пуск / Пауза",
      previousNextFrame: "Пред. / След. кадр",
      title: "Клавиатурные сочетания",
    },
    loading: {
      opening: "Открытие предпросмотра…",
      preparing: "Подготовка совместимого предпросмотра…",
    },
    accessibility: {
      controls: "Элементы управления воспроизведением",
      currentTime: "Текущее время",
      empty: "Пустой предпросмотр",
      source: "Предпросмотр исходного видео",
    },
    crop: {
      bottom: "Изменить обрезку снизу",
      bottomLeft: "Изменить обрезку снизу слева",
      bottomRight: "Изменить обрезку снизу справа",
      left: "Изменить обрезку слева",
      preview: "Предпросмотр обрезки видео",
      right: "Изменить обрезку справа",
      top: "Изменить обрезку сверху",
      topLeft: "Изменить обрезку сверху слева",
      topRight: "Изменить обрезку сверху справа",
    },
  },
  timeline: {
    sceneMarkers: {
      actions: {
        detectScenes: "Найти смены сцен",
        disableSceneMarkers: "Скрыть маркеры сцен",
        enableSceneMarkers: "Показать маркеры сцен",
      },
      status: {
        sceneDetectionFailed: "Не удалось распознать сцены. Попробуйте ещё раз.",
      },
      tooltips: {
        detectScenes:
          "Анализировать исходное видео на смены сцен. Удерживайте Shift при перетаскивании, чтобы привязаться к маркеру сцены или к любому краю диапазона активности аудио.",
      },
    },
    segment: {
      actions: {
        moveSegment: "Переместить выбранный сегмент",
      },
      labels: {
        end: "Конец",
        selectedSegment: "Выбранный сегмент",
        start: "Начало",
      },
      tooltips: {
        moveSegment:
          "Перетащите, чтобы переместить выбранный сегмент — удерживайте Shift для привязки",
        trimReset: "{{label}} — удерживайте Shift для привязки — дважды щёлкните для сброса",
      },
      accessibility: {
        trimEnd: "Конец обрезки",
        trimStart: "Начало обрезки",
        trimValues: "Значения времени обрезки",
      },
    },
    playhead: {
      labels: {
        duration: "Длительность",
        tools: "Инструменты",
      },
      accessibility: {
        playbackPosition: "Позиция воспроизведения",
        seconds: "{{value}} секунд",
        startsAt: "Начинается в {{time}}",
        tools: "Инструменты временной шкалы видео",
        track: "Временная шкала обрезки видео",
      },
    },
    audioMeter: {
      accessibility: {
        audioLevel: "Уровень стереозвука",
        leftAudioChannelLevel: "Уровень звука левого канала",
        rightAudioChannelLevel: "Уровень звука правого канала",
      },
    },
  },
  audio: {
    loudness: {
      analyze: "Анализировать громкость",
      analyzing: "Анализ громкости…",
    },
    activityDetection: {
      analyze: "Анализировать активность звука",
      analyzing: "Анализ активности звука…",
      retry: "Повторить анализ",
      showRanges: "Показать найденные интервалы",
    },
    effects: {
      open: "Эффекты",
      stages: {
        cleanup: "Очистка",
        dynamics: "Динамика",
        level: "Уровень",
        protection: "Защита",
      },
      dialog: {
        applyNotice: "Изменения не будут применены, пока вы не нажмёте «Применить».",
        description: "Эффекты применяются в фиксированном порядке из списка.",
        title: "{{title}} — эффекты",
      },
      appliedSummaryLabel: "Применённые эффекты: {{summary}}",
    },
    output: {
      merge: {
        action: "Объединить выбранные дорожки",
        tooltip: "Все выбранные дорожки объединяются в одну; это требует кодирования.",
      },
      oneTrack: "Выбрана одна дорожка — объединение не требуется",
      videoOnly: "Только видео",
    },
    tracks: {
      mute: "Выключить звук",
      muteWithTitle: "Выключить звук ({{title}})",
      unmute: "Включить звук",
      unmuteWithTitle: "Включить звук ({{title}})",
      advanced: "Дополнительно",
      defaultName: "Аудио {{number}}",
      title: "Аудиодорожки",
      preparingPreview: "Подготовка предпросмотра с этими настройками дорожки…",
      actionsLabel: "Действия аудиодорожки {{number}}",
      gainLabel: "Усиление аудиодорожки {{number}} в децибелах",
      unknownLayout: "неизвестная конфигурация",
    },
    highPass: {
      label: "Фильтр высоких частот",
      cutoffLabel: "Частота среза",
      description: "Уберите низкочастотный гул в этой дорожке.",
      summary: "Фильтр высоких частот ({{cutoff}} Гц)",
    },
    limiter: {
      label: "Лимитер",
      ceilingLabel: "Выходной предел",
      description: "Ограничивать пики этой дорожки.",
      summary: "Лимитер ({{ceiling}} дБ)",
    },
    normalization: {
      label: "Нормализация громкости",
      maxTruePeakLabel: "Максимальный истинный пик (дБTP)",
      targetLufsLabel: "Целевая громкость (LUFS)",
      preset: {
        label: "Предустановка",
        custom: "Своя настройка",
        webVideo: "Веб-видео",
        streaming: "Стриминг",
        broadcast: "Вещание",
      },
      description: "Нормализовать дорожку до целевого уровня громкости.",
      summary: "Нормализация - {{preset}}",
      levelSummary: "Цель {{target}} LUFS · предел пика {{peak}} дБTP",
      manualGainUnavailable: "Ручное усиление недоступно при автоматической нормализации.",
    },
    noiseReduction: {
      label: "Шумоподавление",
      strength: {
        label: "Сила шумоподавления",
        light: "Слабое",
        medium: "Среднее",
        strong: "Сильное",
      },
      description: "Уменьшает фоновый шум в этой аудиодорожке.",
      summary: "Шумоподавление - {{preset}}",
    },
    waveform: {
      preparing: "Подготовка формы волны…",
      unavailable: "Форма волны недоступна",
    },
  },
  support: {
    changelog: {
      open: "Список изменений",
      categories: {
        added: "Добавлено",
        changed: "Изменено",
        deprecated: "Устарело",
        fixed: "Исправлено",
        removed: "Удалено",
        security: "Безопасность",
      },
      title: "Список изменений",
      empty: {
        title: "Выпущенных изменений пока нет.",
        description: "Выпущенные обновления появятся здесь, когда войдут в установленную версию.",
      },
      description: "Выпущенные изменения, включённые в эту версию EasyTrim.",
    },
    project: {
      actions: {
        koFi: "Поддержать на Ko-fi.com",
        projectPage: "Страница проекта",
        projectSupport: "Поддержать проект",
        showLogs: "Показать журналы",
        viewOnGitHub: "Открыть на GitHub",
      },
      messages: {
        buyMeCoffee: "Угостите меня кофе",
      },
    },
    whatsNew: {
      title: "Что нового",
      description: "Изменения с момента последнего открытия EasyTrim.",
    },
  },
  units: {
    framesPerSecond: "{{value}} кадр/с",
    megabitsPerSecond: "{{value}} Мбит/с",
  },
} as const;
