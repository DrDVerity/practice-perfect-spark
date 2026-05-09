
insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', true)
on conflict (id) do nothing;

create policy "Public read post-media"
on storage.objects for select
using (bucket_id = 'post-media');

create policy "Authenticated upload post-media"
on storage.objects for insert
to authenticated
with check (bucket_id = 'post-media');

create policy "Authenticated update post-media"
on storage.objects for update
to authenticated
using (bucket_id = 'post-media');

create policy "Authenticated delete post-media"
on storage.objects for delete
to authenticated
using (bucket_id = 'post-media');
