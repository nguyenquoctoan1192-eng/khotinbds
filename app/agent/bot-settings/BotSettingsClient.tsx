"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type Device = { id:string; device_uid:string; device_name:string|null; platform:string|null; app_version:string|null; is_active:boolean; last_seen_at:string|null; current_status:string|null; status_message:string|null; current_step?:string|null; progress_percent?:number|null; current_group_count?:number|null; total_group_count?:number|null; last_error?:string|null };
type FacebookAccount = { id:string; name:string|null; profile_url:string|null; is_active:boolean; last_group_sync_at:string|null; synced_group_count:number|null; broker_profile_id:string|null };
type Job = { id:string; listing_id:string|null; facebook_group_id:string|null; status:string|null; scheduled_at:string|null; posted_at:string|null; last_error:string|null; attempt_count:number|null; created_at:string|null };
type SettingsResponse = {
  linked:boolean; readyToPost:boolean; error?:string;
  profile:null|{id:string;display_name:string|null;default_contact_phone:string|null;is_active:boolean};
  license?:null|{id:string;name:string|null;is_active:boolean;expires_at:string|null};
  devices:Device[]; facebookAccounts:FacebookAccount[];
  stats?:{waiting:number;processing:number;posted:number;failed:number;groupsPosted:number}; recentJobs?:Job[];
};

const fmt = (v:string|null) => v ? new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short"}).format(new Date(v)) : "Chưa ghi nhận";
const online = (v:string|null) => !!v && Date.now()-new Date(v).getTime()<90_000;
const labelStatus = (s:string|null) => ({posted:"Thành công",success:"Thành công",completed:"Thành công",failed:"Lỗi",error:"Lỗi",processing:"Đang đăng",posting:"Đang đăng",running:"Đang đăng",queued:"Chờ đăng",pending:"Chờ đăng",scheduled:"Chờ đăng"}[String(s||"").toLowerCase()] || s || "Chưa rõ");

export default function BotSettingsClient(){
  const [data,setData]=useState<SettingsResponse|null>(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
  const [message,setMessage]=useState(""),[licenseKey,setLicenseKey]=useState(""),[displayName,setDisplayName]=useState(""),[phone,setPhone]=useState(""),[facebookAccountId,setFacebookAccountId]=useState("");
  async function load(){ setLoading(true); const r=await fetch("/api/agent/bot-settings",{cache:"no-store"}); const j=await r.json() as SettingsResponse; setData(j); setLoading(false); if(r.ok&&j.profile){setDisplayName(j.profile.display_name||"");setPhone(j.profile.default_contact_phone||"");const a=j.facebookAccounts.find(x=>x.broker_profile_id===j.profile?.id);setFacebookAccountId(a?.id||j.facebookAccounts[0]?.id||"");}}
  useEffect(()=>{void load();const t=window.setInterval(()=>void load(),15000);return()=>window.clearInterval(t)},[]);
  const onlineDevices=useMemo(()=>data?.devices.filter(d=>d.is_active&&online(d.last_seen_at))||[],[data]);
  const primaryDevice=onlineDevices[0]||data?.devices[0]; const stats=data?.stats||{waiting:0,processing:0,posted:0,failed:0,groupsPosted:0};
  async function linkLicense(){setSaving(true);setMessage("");const r=await fetch("/api/agent/bot-settings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({licenseKey})});const j=await r.json();setSaving(false);setMessage(r.ok?"Đã liên kết License Bot":j?.error||"Không liên kết được");if(r.ok){setLicenseKey("");await load();}}
  async function save(){setSaving(true);setMessage("");const r=await fetch("/api/agent/bot-settings",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({displayName,defaultContactPhone:phone,facebookAccountId})});const j=await r.json();setSaving(false);setMessage(r.ok?"Đã lưu cài đặt Bot":j?.error||"Không lưu được");if(r.ok)await load();}
  if(loading&&!data)return <div className={styles.loading}>Đang tải trung tâm Bot...</div>;
  if(!data?.linked)return <section className={styles.connectCard}><div className={styles.connectIcon}>🤖</div><h2>Liên kết Bot của bạn</h2><p>Nhập License được Admin cấp để kết nối thiết bị, Facebook và số điện thoại đăng bài.</p><div className={styles.connectForm}><input value={licenseKey} onChange={e=>setLicenseKey(e.target.value)} placeholder="KTB-XXXXXXXX-XXXXXXXX"/><button onClick={linkLicense} disabled={saving||!licenseKey.trim()}>{saving?"Đang liên kết...":"Liên kết Bot"}</button></div>{message&&<div className={styles.message}>{message}</div>}</section>;

  return <div className={styles.dashboard}>
    <section className={styles.topStatus}><div><span className={styles.eyebrow}>BOT FACEBOOK</span><h1>Bot của tôi</h1><p>Quản lý và theo dõi Bot đăng tin Facebook của riêng bạn.</p></div><div className={onlineDevices.length?styles.onlinePill:styles.offlinePill}><span/> {onlineDevices.length?"Bot đang hoạt động":"Bot đang offline"}</div></section>

    <section className={styles.summaryGrid}>
      <article className={styles.summaryCard}><span>Trạng thái Bot</span><strong className={onlineDevices.length?styles.greenText:styles.grayText}>{onlineDevices.length?"Online":"Offline"}</strong><small>{primaryDevice?.status_message||"Chưa có thiết bị hoạt động"}</small></article>
      <article className={styles.summaryCard}><span>License</span><strong>{data.license?.name||"License Bot"}</strong><small>{data.license?.expires_at?`Hết hạn: ${fmt(data.license.expires_at)}`:"Không giới hạn ngày"}</small></article>
      <article className={styles.summaryCard}><span>Thiết bị</span><strong>{primaryDevice?.device_name||primaryDevice?.device_uid||"Chưa kết nối"}</strong><small>{primaryDevice?.platform||"Chưa rõ hệ điều hành"}</small></article>
      <article className={styles.summaryCard}><span>Phiên bản</span><strong>v{primaryDevice?.app_version||"-"}</strong><small>{primaryDevice?`Cập nhật: ${fmt(primaryDevice.last_seen_at)}`:"Chưa ghi nhận"}</small></article>
    </section>

    <section className={styles.contentGrid}>
      <article className={styles.panel}><div className={styles.panelHeader}><div><span className={styles.eyebrow}>THÔNG TIN LIÊN HỆ</span><h2>Cài đặt bài đăng</h2></div><span className={data.readyToPost?styles.ready:styles.warning}>{data.readyToPost?"Sẵn sàng đăng":"Thiếu SĐT"}</span></div>
        <label>Tên môi giới<input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Nguyễn Văn A"/></label>
        <label>SĐT mặc định dùng khi tin không có SĐT riêng<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="0908 123 456" inputMode="tel"/></label>
        <label>Facebook dùng để đăng<select value={facebookAccountId} onChange={e=>setFacebookAccountId(e.target.value)}><option value="">Chưa chọn Facebook</option>{data.facebookAccounts.map(a=><option key={a.id} value={a.id}>{a.name||"Facebook chưa đặt tên"}</option>)}</select></label>
        <button className={styles.primaryButton} onClick={save} disabled={saving}>{saving?"Đang lưu...":"Lưu thông tin"}</button>{message&&<div className={styles.message}>{message}</div>}
      </article>

      <article className={styles.panel}><div className={styles.panelHeader}><div><span className={styles.eyebrow}>XEM TRƯỚC</span><h2>Bài đăng Facebook</h2></div></div><div className={styles.postPreview}><strong>🔥 CHO THUÊ NHÀ NGUYÊN CĂN – QUẬN 10</strong><p>📍 Vị trí: Quận 10</p><p>📐 Diện tích: 4x20m – 80m²</p><p>🏢 Kết cấu: Trệt 2 lầu, 3PN, 4WC</p><p>💰 Giá thuê: 28.000.000đ/tháng</p><hr/><p>☎️ Liên hệ: {phone||"Chưa cài SĐT"}{displayName?` (${displayName})`:""}</p><div className={styles.hashtags}>#nhachothue #nhachothuenguyencan #chothuenhaquan10 #nhaquan10</div></div><small className={styles.note}>Nội dung thật sẽ tự lấy đúng quận, loại hình và SĐT của môi giới.</small></article>

      <article className={styles.panel}><div className={styles.panelHeader}><div><span className={styles.eyebrow}>HÔM NAY</span><h2>Hoạt động Bot</h2></div></div><div className={styles.metricList}><div><span>Đã đăng thành công</span><strong className={styles.greenText}>{stats.posted}</strong></div><div><span>Đang chờ đăng</span><strong>{stats.waiting}</strong></div><div><span>Đang xử lý</span><strong>{stats.processing}</strong></div><div><span>Nhóm đã đăng</span><strong>{stats.groupsPosted}</strong></div><div><span>Lỗi</span><strong className={styles.redText}>{stats.failed}</strong></div></div></article>
    </section>

    {primaryDevice&&<section className={styles.livePanel}><div><span className={styles.eyebrow}>BOT ĐANG LÀM GÌ</span><h2>{primaryDevice.current_step||primaryDevice.status_message||"Đang chờ công việc tiếp theo"}</h2><p>{primaryDevice.current_group_count||0}/{primaryDevice.total_group_count||0} nhóm · {primaryDevice.progress_percent||0}%</p></div><div className={styles.progress}><span style={{width:`${Math.max(0,Math.min(100,primaryDevice.progress_percent||0))}%`}}/></div></section>}

    <section className={styles.panel}><div className={styles.panelHeader}><div><span className={styles.eyebrow}>NHẬT KÝ</span><h2>Hoạt động gần đây</h2></div></div><div className={styles.tableWrap}><table><thead><tr><th>Thời gian</th><th>Tin đăng</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>{(data.recentJobs||[]).length?(data.recentJobs||[]).map(j=><tr key={j.id}><td>{fmt(j.posted_at||j.created_at)}</td><td>{j.listing_id?`Tin ${j.listing_id.slice(0,8)}`:"Không rõ tin"}</td><td><span className={styles.statusBadge}>{labelStatus(j.status)}</span></td><td>{j.last_error||`Lần thử: ${j.attempt_count||0}`}</td></tr>):<tr><td colSpan={4} className={styles.empty}>Chưa có hoạt động đăng bài.</td></tr>}</tbody></table></div></section>
  </div>;
}

