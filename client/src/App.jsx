import AppRoutes from "./routes/AppRoutes";
import InUseNotice from "./components/ui/InUseNotice";
import AskDialogHost from "./components/ui/AskDialog";

function App() {
  return (
    <>
      <AppRoutes />
      {/* Says what a record is still used by when a delete is refused (components/ui/InUseNotice). */}
      <InUseNotice />
      {/* The system's "Are you sure?" / "Why?" boxes — askConfirm / askText (components/ui/AskDialog). */}
      <AskDialogHost />
    </>
  );
}

export default App;
