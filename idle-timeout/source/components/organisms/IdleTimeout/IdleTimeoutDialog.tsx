import {Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle} from "@mui/material";
import {useTranslation} from "react-i18next";
import {IDLE_TIMEOUT_MINUTES} from "./idleTimeoutConfig";

type IdleTimeoutDialogProps = {
  open: boolean;
  isLoggingOut: boolean;
  onConfirm: () => void;
};

export const IdleTimeoutDialog = ({open, isLoggingOut, onConfirm}: IdleTimeoutDialogProps) => {
  const {t} = useTranslation();

  return (
    <Dialog
      open={open}
      // Clicking outside the pop-up or pressing Escape must not close it: the user has to click OK.
      onClose={() => undefined}
      disableEscapeKeyDown
      aria-labelledby="idle-timeout-title"
      aria-describedby="idle-timeout-message"
      PaperProps={{role: "alertdialog"}}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle id="idle-timeout-title">{t("idleTimeout.title", "Session timed out")}</DialogTitle>
      <DialogContent>
        <DialogContentText id="idle-timeout-message">
          {t("idleTimeout.message", {
            minutes: IDLE_TIMEOUT_MINUTES,
            defaultValue:
              "You have been inactive for {{minutes}} minutes, so you will be logged out to keep your account secure. Click OK to go back to the login screen.",
          })}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onConfirm} disabled={isLoggingOut} autoFocus>
          {t("idleTimeout.ok", "OK")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
