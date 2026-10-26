import AppRoutes from "./routes/AppRoutes";
import InUseNotice from "./components/ui/InUseNotice";

function App() {
  return (
    <>
      <AppRoutes />
      {/* Says what a record is still used by when a delete is refused (components/ui/InUseNotice). */}
      <InUseNotice />
    </>
  );
}

export default App;
