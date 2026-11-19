update public.venues
set keywords = array_remove(array_remove(array_remove(keywords, 'neighborhood'), 'date night'), 'study spot')
where keywords && array['neighborhood', 'date night', 'study spot'];
