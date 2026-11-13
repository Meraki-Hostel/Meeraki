import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pickImage } from '@/api/files';
import { toApiError } from '@/api/errors';
import { complaints } from '@/api/services';
import { Body, Button, Chips, Field, Notice, Screen } from '@/components/ui';
import { color, radius, space } from '@/components/theme';
import type { ComplaintCategory, Priority } from '@/contract/domain';
import type { LocalFile } from '@/contract/mobile';
import { useAction } from '@/hooks/api';
import { COMPLAINT_CATEGORIES, PRIORITIES } from '@/lib/labels';

const MAX_PHOTOS = 3; // the API accepts at most 3 attachments

export default function NewComplaint() {
  const router = useRouter();
  const [category, setCategory] = useState<ComplaintCategory>('electrical');
  const [priority, setPriority] = useState<Priority>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<LocalFile[]>([]);
  const create = useAction(complaints.create);

  async function addPhoto(source: 'camera' | 'library') {
    try {
      const f = await pickImage(source);
      if (f) setPhotos((p) => [...p, f].slice(0, MAX_PHOTOS));
    } catch (e) {
      Alert.alert('Photo', toApiError(e).message);
    }
  }

  async function submit() {
    const fe: Record<string, string> = {};
    if (!title.trim()) fe.title = 'Give it a short title';
    if (!description.trim()) fe.description = 'Describe the problem';
    if (Object.keys(fe).length) { create.setFieldErrors(fe); return; }
    if (await create.run({ category, priority, title: title.trim(), description: description.trim(), attachments: photos })) router.back();
  }

  return (
    <Screen>
      <Notice error={create.error} />
      <Chips<ComplaintCategory> label="Category" value={category} onChange={setCategory} options={COMPLAINT_CATEGORIES} />
      <Field label="Title" value={title} onChangeText={setTitle} error={create.fieldErrors.title} placeholder="e.g. Fan not working" maxLength={120} />
      <Field label="What's wrong?" value={description} onChangeText={setDescription} error={create.fieldErrors.description} multiline placeholder="Where is it, and since when?" />
      <Chips<Priority> label="How urgent?" value={priority} onChange={setPriority} options={PRIORITIES} />

      <Body muted>Photos (optional, up to {MAX_PHOTOS})</Body>
      <View style={{ flexDirection: 'row', gap: space.sm, marginVertical: space.sm, flexWrap: 'wrap' }}>
        {photos.map((p, i) => (
          <View key={p.uri}>
            <Image source={{ uri: p.uri }} style={{ width: 88, height: 88, borderRadius: radius.md }} accessibilityLabel={`Photo ${i + 1}`} />
            <Pressable onPress={() => setPhotos((all) => all.filter((x) => x.uri !== p.uri))} accessibilityLabel={`Remove photo ${i + 1}`}
              style={{ position: 'absolute', top: -8, right: -8, backgroundColor: color.card, borderRadius: 12 }} hitSlop={8}>
              <Ionicons name="close-circle" size={24} color={color.brick} />
            </Pressable>
          </View>
        ))}
      </View>
      {!!create.fieldErrors.attachments && <Body style={{ color: color.brick } as object}>{create.fieldErrors.attachments}</Body>}
      {photos.length < MAX_PHOTOS && (
        <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.lg }}>
          <Button title="Camera" icon="camera-outline" variant="secondary" onPress={() => { void addPhoto('camera'); }} style={{ flex: 1 }} />
          <Button title="Gallery" icon="images-outline" variant="secondary" onPress={() => { void addPhoto('library'); }} style={{ flex: 1 }} />
        </View>
      )}
      <Button title="Submit complaint" onPress={() => { void submit(); }} loading={create.busy} />
    </Screen>
  );
}
