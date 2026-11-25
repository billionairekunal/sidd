import Guard from "@/components/Guard";
import Dashboard from "@/views/Dashboard";

export default function Page() {
  return (
    <Guard roles={["owner", "dispatcher"]}>
      <Dashboard />
    </Guard>
  );
}
