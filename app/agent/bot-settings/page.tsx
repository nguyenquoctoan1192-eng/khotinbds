import { redirect } from "next/navigation";
import SiteNavbar from "@/app/components/site-navbar";
import { getServerProfile } from "@/lib/serverAuth";
import BotSettingsClient from "./BotSettingsClient";
import styles from "./page.module.css";
export const dynamic = "force-dynamic";
export default async function AgentBotSettingsPage(){const profile=await getServerProfile();if(!profile||profile.status!=="approved")redirect("/login");if(profile.role!=="agent")redirect(profile.role==="admin"?"/admin":"/");return <div className={styles.page}><SiteNavbar/><main className={styles.main}><BotSettingsClient/></main></div>}

