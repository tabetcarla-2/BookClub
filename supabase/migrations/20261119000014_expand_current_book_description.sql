update public.books
set description = 'A page-turning story about secrets, marriage, and the things we keep from the people closest to us. When a woman discovers a letter her husband wrote for her to read after his death, a private secret begins to reshape the lives of everyone around them. It is a sharp, emotional look at love, friendship, and the stories we tell ourselves.'
where lower(title) = 'a husband''s secret'
  and (description is null or length(description) < 140);
