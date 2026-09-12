import WarehouseApp from "@/components/warehouse/warehouse-app";
import { RequireSession } from "@/components/auth/session-provider";
export default function Page() { return <RequireSession><WarehouseApp /></RequireSession>; }
// export default function Page() { return <WarehouseApp />; }