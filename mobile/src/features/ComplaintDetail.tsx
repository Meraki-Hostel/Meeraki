import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { toApiError } from '@/api/errors';
import { complaints } from '@/api/services';
import { http } from '@/api/client';
import { useUser } from '@/auth/session';
import { Badge, Body, Button, Card, Chips, ErrorState, Field, Loading, Notice, Row, Screen, Section, Strong } from '@/components/ui';
import { color, space } from '@/components/theme';
import type { ComplaintStatus } from '@/contract/domain';
import { useAction, useApi } from '@/hooks/api';
import { dateTime, humanize } from '@/lib/format';
import { COMPLAINT_STATUSES } from '@/lib/labels';

/** One complaint. Residents can comment; staff can also change status and add internal notes. */
export function ComplaintDetail({ id }: { id: string }) {
  const user = useUser();
  const staff = user.role !== 'student';
  const c = useApi(['complaints', id], () => complaints.get(id));
  const update = useAction(complaints.update);
  const comment = useAction(complaints.addComment);
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);

  if (c.loading) return <Loading />;
  if (c.error || !c.data) return <Screen><ErrorState error={c.error} onRetry={c.refetch} /></Screen>;
  const x = c.data;

  async function openAttachment(uploadId: string) {
    try {
      const { url } = await http.get<{ url: string }>(`/uploads/${uploadId}/url`);
      await WebBrowser.openBrowserAsync(url);
    } catch (e) { Alert.alert('Attachment', toApiError(e).message); }
  }

  async function send() {
    if (!body.trim()) return;
    if (await comment.run(x.id, body.trim(), staff && internal)) { setBody(''); setInternal(false); }
  }

  return (
    <Screen onRefresh={c.refetch} refreshing={c.refreshing}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Body muted>{x.ticketNo}</Body>
          <Badge label={x.status} />
        </View>
        <Strong>{x.title}</Strong>
        <Body>{x.description}</Body>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' }}>
          <Badge label={humanize(x.category)} tone="neutral" />
          <Badge label={x.priority} tone={x.priority === 'urgent' ? 'bad' : x.priority === 'high' ? 'warn' : 'neutral'} />
        </View>
        {staff && <Body muted style={{ marginTop: space.sm } as object}>{x.studentName}{x.roomNumber ? ` · Room ${x.roomNumber}` : ''} · {x.propertyName}</Body>}
        {!!x.assigneeName && <Body muted>Assigned to {x.assigneeName}</Body>}
        <Body muted>Raised {dateTime(x.createdAt)}</Body>
      </Card>

      {(x.attachmentFiles ?? []).length > 0 && (
        <Section title="Photos">
          <Card>
            {(x.attachmentFiles ?? []).map((f) => (
              <Row key={f.id} title={f.fileName} subtitle={`${f.sizeKb} KB`} icon="image-outline" onPress={() => { void openAttachment(f.id); }} />
            ))}
          </Card>
        </Section>
      )}

      {staff && (
        <Section title="Update status">
          <Notice error={update.error} />
          <Chips<ComplaintStatus> value={x.status} options={COMPLAINT_STATUSES}
            onChange={(status) => { if (status !== x.status) void update.run(x.id, { status }); }} />
        </Section>
      )}

      <Section title="Updates">
        {x.comments.length === 0 && x.history.length <= 1 && <Body muted>No updates yet.</Body>}
        {[...x.history.map((h) => ({ key: `h${h.id}`, at: h.at, who: h.changedBy, text: `Status: ${humanize(h.status)}${h.note ? ` — ${h.note}` : ''}`, internal: false })),
          ...x.comments.map((m) => ({ key: `c${m.id}`, at: m.createdAt, who: m.authorName, text: m.body, internal: m.internal }))]
          .sort((a, b) => a.at.localeCompare(b.at))
          .map((e) => (
            <Card key={e.key} style={e.internal && { backgroundColor: color.amberWash, borderColor: color.amberWash }}>
              <Body muted>{e.who} · {dateTime(e.at)}{e.internal ? ' · staff only' : ''}</Body>
              <Body>{e.text}</Body>
            </Card>
          ))}
      </Section>

      {x.status !== 'closed' && (
        <Section title={staff ? 'Reply or note' : 'Add a comment'}>
          <Notice error={comment.error} />
          <Field label="Message" value={body} onChangeText={setBody} multiline error={comment.fieldErrors.body} />
          {staff && (
            <Chips<'public' | 'internal'> value={internal ? 'internal' : 'public'} onChange={(v) => setInternal(v === 'internal')}
              options={[{ value: 'public', label: 'Visible to resident' }, { value: 'internal', label: 'Staff only' }]} />
          )}
          <Button title="Send" icon="send" onPress={() => { void send(); }} loading={comment.busy} disabled={!body.trim()} />
        </Section>
      )}
    </Screen>
  );
}
