import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import { OWNER_NAME, useStore } from '../../store/AppStore'
import { Button, Card, CardHeader, Field, Input, PageHeader, Toggle, useConfirm, useToast } from '../../components/ui'

export default function OwnerSettings() {
  const { data, updateSettings, resetDemo } = useStore()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const s = data.settings
  const [f, setF] = useState({ orgName: s.orgName, gstin: s.gstin, lateFeePerDay: String(s.lateFeePerDay), rentDueDay: String(s.rentDueDay) })

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Organisation-wide preferences" />
      <div className="space-y-5">
        <Card>
          <CardHeader title="Organisation" subtitle={`Owner: ${OWNER_NAME}`} />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <Field label="Business name"><Input value={f.orgName} onChange={(e) => setF({ ...f, orgName: e.target.value })} /></Field>
            <Field label="GSTIN"><Input value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value })} /></Field>
            <Field label="Rent due day" hint="Day of month rent is due"><Input type="number" min={1} max={28} value={f.rentDueDay} onChange={(e) => setF({ ...f, rentDueDay: e.target.value })} /></Field>
            <Field label="Late fee per day"><Input prefix="₹" type="number" value={f.lateFeePerDay} onChange={(e) => setF({ ...f, lateFeePerDay: e.target.value })} /></Field>
            <div className="sm:col-span-2">
              <Button variant="primary" onClick={() => { updateSettings({ orgName: f.orgName, gstin: f.gstin, lateFeePerDay: Number(f.lateFeePerDay) || 0, rentDueDay: Number(f.rentDueDay) || 5 }); toast.success('Settings saved') }}>Save changes</Button>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Owner notifications" subtitle="Delivery is simulated in this prototype" />
          <div className="space-y-4 px-5 pb-5">
            <Toggle checked={s.notifyEmergency} onChange={(v) => updateSettings({ notifyEmergency: v })} label="Emergency alerts" description="Get notified when any student raises an emergency alert" />
            <Toggle checked={s.notifyOverdue} onChange={(v) => updateSettings({ notifyOverdue: v })} label="Overdue rent summary" description="Daily summary of overdue payments across properties" />
            <Toggle checked={s.notifyWeeklyDigest} onChange={(v) => updateSettings({ notifyWeeklyDigest: v })} label="Weekly business digest" description="Occupancy, revenue and complaints every Monday" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Prototype data" subtitle="Everything you change is saved in this browser only" />
          <div className="px-5 pb-5">
            <Button icon={RotateCcw} onClick={async () => {
              const { ok } = await confirm({ title: 'Reset demo data?', description: 'All changes will be discarded and the original mock data restored.', tone: 'danger', confirmLabel: 'Reset data' })
              if (ok) { resetDemo(); toast.success('Demo data reset'); navigate('/owner') }
            }}>Reset demo data</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
