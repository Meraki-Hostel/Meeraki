import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { feedback } from '@/api/services';
import { Body, Button, Card, Chips, Field, Notice, Screen, Section, Strong } from '@/components/ui';
import { color, space } from '@/components/theme';
import type { Feedback, FeedbackCategory } from '@/contract/domain';
import { useAction, useApi } from '@/hooks/api';
import { ago, humanize } from '@/lib/format';
import { FEEDBACK_CATEGORIES } from '@/lib/labels';

export default function StudentFeedback() {
  const mine = useApi(['feedback', 'mine'], feedback.mine);
  const submit = useAction(feedback.submit);
  const [category, setCategory] = useState<FeedbackCategory>('food');
  const [rating, setRating] = useState<Feedback['rating'] | 0>(0);
  const [comment, setComment] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  async function send() {
    if (!rating) { submit.setFieldErrors({ rating: 'Pick a rating' }); return; }
    if (await submit.run({ category, rating, comment: comment.trim(), anonymous })) { setRating(0); setComment(''); }
  }

  return (
    <Screen onRefresh={mine.refetch} refreshing={mine.refreshing}>
      {submit.done && <Notice message="Thanks — your feedback was sent." tone="good" />}
      <Notice error={submit.error} />
      <Chips<FeedbackCategory> label="About" value={category} onChange={setCategory} options={FEEDBACK_CATEGORIES} />
      <Body muted>Rating</Body>
      <View style={{ flexDirection: 'row', gap: space.sm, marginVertical: space.sm }} accessibilityRole="adjustable" accessibilityLabel={`Rating ${rating} of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setRating(n as Feedback['rating'])} accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`} hitSlop={6}>
            <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={36} color={n <= rating ? color.amber : color.mute} />
          </Pressable>
        ))}
      </View>
      {!!submit.fieldErrors.rating && <Body style={{ color: color.brick } as object}>{submit.fieldErrors.rating}</Body>}
      <Field label="Comment" value={comment} onChangeText={setComment} error={submit.fieldErrors.comment} multiline placeholder="What's good, what should change?" />
      <Chips<'named' | 'anonymous'> value={anonymous ? 'anonymous' : 'named'} onChange={(v) => setAnonymous(v === 'anonymous')}
        options={[{ value: 'named', label: 'Show my name' }, { value: 'anonymous', label: 'Anonymous' }]} />
      <Button title="Send feedback" onPress={() => { void send(); }} loading={submit.busy} />

      <Section title="What you've sent">
        {(mine.data ?? []).length === 0 ? <Body muted>Nothing yet.</Body> : (mine.data ?? []).map((f) => (
          <Card key={f.id}>
            <Strong>{humanize(f.category)} · {'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</Strong>
            {!!f.comment && <Body>{f.comment}</Body>}
            <Body muted>{ago(f.createdAt)}{f.anonymous ? ' · anonymous' : ''}</Body>
          </Card>
        ))}
      </Section>
    </Screen>
  );
}
