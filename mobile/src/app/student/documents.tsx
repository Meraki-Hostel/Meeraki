import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { pickImage } from '@/api/files';
import { toApiError } from '@/api/errors';
import { documents } from '@/api/services';
import { Badge, Body, Button, Card, Empty, ErrorState, Loading, Notice, Screen, Strong } from '@/components/ui';
import { space } from '@/components/theme';
import type { DocumentRecord } from '@/contract/domain';
import { useAction, useApi } from '@/hooks/api';
import { date } from '@/lib/format';
import { DOCUMENT_LABELS } from '@/lib/labels';

export default function StudentDocuments() {
  const list = useApi(['documents', 'mine'], documents.mine);
  const upload = useAction(documents.upload);
  const [busy, setBusy] = useState<string | null>(null);

  async function add(doc: DocumentRecord, source: 'camera' | 'library') {
    try {
      const file = await pickImage(source);
      if (!file) return;
      setBusy(doc.id);
      await upload.run(doc.id, file);
    } catch (e) {
      Alert.alert('Upload', toApiError(e).message);
    } finally {
      setBusy(null);
    }
  }

  function choose(doc: DocumentRecord) {
    Alert.alert(DOCUMENT_LABELS[doc.type], 'Add a clear photo of the document.', [
      { text: 'Take photo', onPress: () => { void add(doc, 'camera'); } },
      { text: 'Choose from gallery', onPress: () => { void add(doc, 'library'); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function view(doc: DocumentRecord) {
    try { await WebBrowser.openBrowserAsync(await documents.fileUrl(doc.id)); }
    catch (e) { Alert.alert('Document', toApiError(e).message); }
  }

  if (list.loading) return <Loading />;
  if (list.error) return <Screen><ErrorState error={list.error} onRetry={list.refetch} /></Screen>;
  const rows = list.data ?? [];

  return (
    <Screen onRefresh={list.refetch} refreshing={list.refreshing}>
      <Notice error={upload.error ?? (upload.fieldErrors.file ? new Error(upload.fieldErrors.file) : undefined)} />
      {rows.length === 0 && <Empty title="No documents requested" body="Your hostel hasn't asked for any documents." />}
      {rows.map((d) => (
        <Card key={d.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Strong>{DOCUMENT_LABELS[d.type] ?? d.type}</Strong>
            <Badge label={d.status} />
          </View>
          {d.fileName && <Body muted>{d.fileName}{d.uploadedAt ? ` · ${date(d.uploadedAt)}` : ''}</Body>}
          {d.status === 'rejected' && !!d.note && <Body>Office: {d.note}</Body>}
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
            {d.status !== 'missing' && <Button title="View" variant="secondary" icon="eye-outline" onPress={() => { void view(d); }} style={{ flex: 1 }} />}
            {d.status !== 'verified' && (
              <Button title={d.status === 'missing' ? 'Upload' : 'Replace'} icon="cloud-upload-outline" onPress={() => choose(d)}
                loading={busy === d.id} style={{ flex: 1 }} />
            )}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
