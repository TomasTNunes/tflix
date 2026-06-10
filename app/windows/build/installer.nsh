; ───────────────────────────────────────────────────────────────
;  TFLIX — custom NSIS hooks for electron-builder
;
;  Adds an opt-in checkbox to the uninstaller that, when ticked, also
;  removes all per-user app data (Electron cache, cookies, and the saved
;  localStorage server choice) stored in the user-data folder.
;
;  The user-data folder is named after Electron's app name, which is the
;  "name" field in package.json ("tflix-app"). On Windows that resolves to
;  %APPDATA%\tflix-app  (NSIS: $APPDATA\tflix-app).
;
;  Two electron-builder/NSIS realities shape this script:
;
;   1) Two compilation passes. The installer and the uninstaller are built
;      by separate makensis runs; customUnWelcomePage / customUnInstall are
;      only inserted in the uninstaller pass. So the page vars are declared
;      under !ifdef BUILD_UNINSTALLER — declaring them in the installer pass
;      would leave them unused (NSIS warning 6001, fatal to the build).
;
;   2) Two run-time instances. The custom page runs in the outer (UI)
;      instance, but the uninstall Section can run in a separate elevated
;      (inner) instance where page variables are reset. So the checkbox
;      choice is persisted to HKCU (shared across the same user's instances)
;      and re-read inside the Section. The Section also forces the per-user
;      shell context, because when $installMode == "all" the default context
;      is "all" and $APPDATA would otherwise point at C:\ProgramData.
; ───────────────────────────────────────────────────────────────

!include nsDialogs.nsh
!include LogicLib.nsh

; Electron user-data folder name (== package.json "name").
!define TFLIX_USERDATA_DIR "tflix-app"
; Registry bridge between the UI instance and the (possibly elevated) section.
!define TFLIX_REG_KEY "Software\tflix-app"
!define TFLIX_REG_VALUE "DeleteAppDataOnUninstall"

!ifdef BUILD_UNINSTALLER
  Var DeleteDataCheckbox
  Var DeleteDataState
!endif

; Custom uninstaller welcome page carrying the "delete app data" checkbox.
!macro customUnWelcomePage
  UninstPage custom un.tflixWelcome un.tflixWelcomeLeave

  Function un.tflixWelcome
    !insertmacro MUI_HEADER_TEXT "Uninstall $(^Name)" "Remove $(^Name) from your computer."

    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 24u "This wizard will uninstall $(^Name) from your computer.$\r$\nClick Uninstall to continue."
    Pop $0

    ${NSD_CreateCheckbox} 0 40u 100% 12u "Also delete all app data (cache and saved settings)"
    Pop $DeleteDataCheckbox

    nsDialogs::Show
  FunctionEnd

  Function un.tflixWelcomeLeave
    ${NSD_GetState} $DeleteDataCheckbox $DeleteDataState
    ; Persist the choice for the uninstall Section, which may run in a
    ; separate elevated instance where $DeleteDataState would be reset.
    ${If} $DeleteDataState == ${BST_CHECKED}
      WriteRegStr HKCU "${TFLIX_REG_KEY}" "${TFLIX_REG_VALUE}" "1"
    ${Else}
      DeleteRegValue HKCU "${TFLIX_REG_KEY}" "${TFLIX_REG_VALUE}"
    ${EndIf}
  FunctionEnd
!macroend

; Runs at the start of the uninstall Section. If the checkbox was ticked,
; wipe the per-user data folder.
!macro customUnInstall
  ReadRegStr $0 HKCU "${TFLIX_REG_KEY}" "${TFLIX_REG_VALUE}"
  ${If} $0 == "1"
    ; Electron always stores app data per-user. Force the user shell context
    ; so $APPDATA is %APPDATA% (roaming) even when uninstalling an all-users
    ; install (where the context would otherwise be "all" → C:\ProgramData).
    SetShellVarContext current
    RMDir /r "$APPDATA\${TFLIX_USERDATA_DIR}"
    DeleteRegKey HKCU "${TFLIX_REG_KEY}"
    ${If} $installMode == "all"
      SetShellVarContext all
    ${EndIf}
  ${EndIf}
!macroend
