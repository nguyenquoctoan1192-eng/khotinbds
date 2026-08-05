-- Chỉ chạy trước khi test bản mới.
-- Xóa các job chưa đăng của cấu trúc cũ để sync tạo lại đúng 1 job/tin.

delete from public.social_post_jobs
where status in ('pending', 'processing', 'failed');

delete from public.social_post_batches b
where not exists (
  select 1
  from public.social_post_jobs j
  where j.batch_id = b.id
);
