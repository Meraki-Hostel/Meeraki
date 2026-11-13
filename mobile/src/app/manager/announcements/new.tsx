import { useRouter } from 'expo-router';
import { useState } from 'react';
import { announcements } from '@/api/services';
import { Body, Button, Chips, Field, Notice, Screen } from '@/components/ui';
import type { AnnouncementCategory } from '@/contract/domain';
import { useAction } from '@/hooks/api';
import { ANNOUNCEMENT_CATEGORIES } from '@/lib/labels';

/** Posts to every resident of the property. Floor/room targeting is on the web app. */
export default function NewAnnouncement() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<AnnouncementCategory>('general');
  const create = useAction(announcements.create);

  async function submit() {
    const fe: Record<string, string> = {};
    if (!title.trim()) fe.title = 'Add a title';
    if (!body.trim()) fe.body = 'Write the announcement';
    if (Object.keys(fe).length) { create.setFieldErrors(fe); return; }
    if (await create.run({ title: title.trim(), body: body.trim(), category, audience: { type: 'all', values: [] } }, true)) router.back();
  }

  return (
    <Screen>
      <Body muted>Goes to every resident right away, as an in-app notice and a push notification.</Body>
      <Notice error={create.error} />
      <Chips<AnnouncementCategory> label="Category" value={category} onChange={setCategory} options={ANNOUNCEMENT_CATEGORIES} />
      <Field label="Title" value={title} onChangeText={setTitle} error={create.fieldErrors.title} maxLength={140} />
      <Field label="Message" value={body} onChangeText={setBody} error={create.fieldErrors.body} multiline />
      <Button title="Publish" icon="megaphone-outline" onPress={() => { void submit(); }} loading={create.busy} />
    </Screen>
  );
}
