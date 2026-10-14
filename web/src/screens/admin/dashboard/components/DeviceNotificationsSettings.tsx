import React, { useState } from "react";
import { Bell, Send } from "lucide-react";
import { Alert, Button, Modal } from "../../../../ui";
import { usePushNotifications } from "../../../../lib/pwa/usePushNotifications";

/** Device preferences stay in Settings. Test delivery always requires a deliberate confirmation. */
export function DeviceNotificationsSettings() {
  const {
    permission,
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    sendTestNotification,
  } = usePushNotifications();
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  const [confirmTest, setConfirmTest] = useState(false);
  const [testing, setTesting] = useState(false);
  async function change(enable: boolean) {
    const ok = await (enable ? subscribe() : unsubscribe());
    setFailed(!ok);
    setNotice(
      ok
        ? enable
          ? "Device notifications enabled."
          : "Device notifications disabled."
        : "Could not update device notifications. Check browser permission and try again.",
    );
  }
  async function test() {
    setTesting(true);
    try {
      const ok = await sendTestNotification();
      setFailed(!ok);
      setNotice(
        ok
          ? "Test notification sent to this device."
          : "Could not send the test notification. Try again.",
      );
      setConfirmTest(false);
    } finally {
      setTesting(false);
    }
  }
  return (
    <section className="rounded-module border border-admin-line bg-white p-5 space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-[18px] font-semibold text-fg">
          <Bell className="size-5 text-admin-brand" />
          Device notifications
        </h3>
        <p className="mt-1 text-[14px] text-fg-muted">
          Receive operational notifications on this browser. This preference is
          specific to this device.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-admin-surface p-3">
        <p className="text-[14px] font-medium">
          {!isSupported
            ? "Not supported in this browser"
            : permission === "denied"
              ? "Blocked in browser settings"
              : isSubscribed
                ? "Enabled on this device"
                : "Not enabled on this device"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!isSupported || permission === "denied" || isLoading}
            loading={isLoading}
            onClick={() => void change(!isSubscribed)}
          >
            {isSubscribed ? "Disable" : "Enable notifications"}
          </Button>
          {isSubscribed && (
            <Button
              variant="ghost"
              iconLeft={<Send />}
              onClick={() => setConfirmTest(true)}
            >
              Test this device
            </Button>
          )}
        </div>
      </div>
      {permission === "denied" && (
        <p className="text-[13px] text-fg-muted">
          Allow notifications for this site in your browser settings, then
          refresh.
        </p>
      )}
      {notice && <Alert tone={failed ? "danger" : "success"} title={notice} />}
      <details className="text-[13px] text-fg-muted">
        <summary className="cursor-pointer font-medium text-fg">
          Phone setup
        </summary>
        <p className="mt-2">
          On iPhone or iPad, add the application to your Home Screen and open it
          there before enabling notifications. Your browser must support Web
          Push.
        </p>
      </details>
      <Modal
        open={confirmTest}
        onClose={() => setConfirmTest(false)}
        title="Send a test to this device?"
        size="sm"
        dismissible={!testing}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              disabled={testing}
              onClick={() => setConfirmTest(false)}
            >
              Cancel
            </Button>
            <Button loading={testing} onClick={() => void test()}>
              Send test
            </Button>
          </div>
        }
      >
        <p className="text-body text-fg-muted">
          This sends one real test notification to the current device.
        </p>
      </Modal>
    </section>
  );
}
