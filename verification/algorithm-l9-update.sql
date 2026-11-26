INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '073acac1-91ce-43fb-bce8-11376160ddd9',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-11' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='在雜湊表中，鍵值（Key）到表索引（Index）的對應關係稱為？'
    AND json_extract(data,'$.type')='單選題' AND json(json_extract(data,'$.opts'))='["鏈結串列","雜湊函數 (Hash function)","探測序列","排序法則"]'
    AND json_extract(data,'$.a')='B' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','先把鍵 k 送進雜湊函數 h，再用 h(k) 決定表的位置。鏈結串列用來保存落在同一桶的資料；探測序列是碰撞後依序檢查的位置；排序則負責排列資料。','$.category','雜湊基本觀念與應用'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-11' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='073acac1-91ce-43fb-bce8-11376160ddd9' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '43dd6f10-47f6-41a4-8c20-f839b51c4f3d',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-3' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='什麼是「衝突」（Collision）？'
    AND json_extract(data,'$.type')='單選題' AND json(json_extract(data,'$.opts'))='["雜湊表已滿","兩個不同的鍵值雜湊到相同位置","雜湊函數失效","兩個相同的鍵值"]'
    AND json_extract(data,'$.a')='B' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','若不同鍵 k₁、k₂ 得到同一索引 h(k₁)=h(k₂)，就發生碰撞。表還有空格也可能碰撞，且同一個鍵得出相同索引本來就是確定性函數的結果。碰撞由鏈結或探測處理。','$.category','雜湊基本觀念與應用'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-3' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='43dd6f10-47f6-41a4-8c20-f839b51c4f3d' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '5e46eed4-ecfa-4b5a-88f4-98035d95aa6f',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-12' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='假設雜湊表長度為 m，直接定址法（Direct addressing）適用於？'
    AND json_extract(data,'$.type')='單選題' AND json(json_extract(data,'$.opts'))='["資料均勻分佈","鍵值空間 U 很小","資料無序","鍵值空間 U 極大"]'
    AND json_extract(data,'$.a')='B' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','直接定址替每個可能的鍵預留一格，因此空間大小取決於整個 U，而非只取決於已存的鍵數。U 小時才適合；資料是否排序或均勻分布不會減少這筆空間需求。','$.category','雜湊基本觀念與應用'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-12' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='5e46eed4-ecfa-4b5a-88f4-98035d95aa6f' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '0a2a3972-c37b-46f8-babb-777ce472aa50',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-10a5c455-d3b4-411e-8d5d-c96554917d48-3' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='雜湊表（Hash Table）的主要目的是為了實現什麼操作的平均 O(1) 效能？'
    AND json_extract(data,'$.type')='單選題' AND json(json_extract(data,'$.opts'))='["排序 (Sorting)","圖形搜尋 (Graph searching)","字典運算 (Dictionary operations)","樹狀遍歷 (Tree traversal)"]'
    AND json_extract(data,'$.a')='C' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','字典運算包括依鍵搜尋、插入與刪除。雜湊分布合理且負載受控時，這些操作可達平均常數時間。排序需處理次序，圖形搜尋與樹遍歷需依結構走訪，不能靠一次雜湊完成。','$.category','雜湊基本觀念與應用'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-10a5c455-d3b4-411e-8d5d-c96554917d48-3' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='0a2a3972-c37b-46f8-babb-777ce472aa50' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT 'e48f417d-9a68-4a93-9352-3b40c7ee5713',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-13' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='下列哪些應用場景適合使用雜湊表？'
    AND json_extract(data,'$.type')='多選題' AND json(json_extract(data,'$.opts'))='["符號表 (Symbol tables)","快取系統 (Caching)","二維陣列排序","編譯器的變數儲存"]'
    AND json_extract(data,'$.a')='A、B、D' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','符號表、以鍵查找的快取、以及編譯器用變數名稱找屬性，都需要依鍵存取。雜湊表適合這些查找；若要按大小排序二維陣列，雜湊索引不會提供鍵的順序。','$.category','雜湊基本觀念與應用'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-13' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='e48f417d-9a68-4a93-9352-3b40c7ee5713' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT 'a8a62a1f-5f36-4574-94bf-e108e5cefbb4',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-5' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='雜湊衝突是不可避免的，因為 ____________ 空間大於雜湊表大小 (請用小寫英文回答)'
    AND json_extract(data,'$.type')='填空題' AND json(json_extract(data,'$.opts'))='[]'
    AND json_extract(data,'$.a')='key' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','鍵值空間（key space）能提供的鍵比槽數多。把所有可能的鍵分配到較少的槽，依鴿籠原理，至少有兩個不同鍵對到同一個槽。因此填 key。','$.category','雜湊基本觀念與應用'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-5' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='a8a62a1f-5f36-4574-94bf-e108e5cefbb4' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '8d6b792b-7857-41dd-975d-6ae17d59d6d8',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-276edad2-8f62-43e9-b7cc-ff7216f423c6-7' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='雜湊函數輸入的鍵值空間稱為 ____________ (請用小寫英文回答)'
    AND json_extract(data,'$.type')='填空題' AND json(json_extract(data,'$.opts'))='[]'
    AND json_extract(data,'$.a')='universe' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','universe 是所有可能輸入鍵的集合，通常寫 U。表內當下實際存放的鍵只是 U 的一部分。例如鍵可為所有學號，表內只有這堂課學生的學號。','$.category','雜湊基本觀念與應用'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-276edad2-8f62-43e9-b7cc-ff7216f423c6-7' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='8d6b792b-7857-41dd-975d-6ae17d59d6d8' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '15f486ff-80ee-4b1e-8708-12384c94e777',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-12' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='下列何者最常被選作乘法雜湊法中的常數 A？'
    AND json_extract(data,'$.type')='單選題' AND json(json_extract(data,'$.opts'))='["1 one","2 two","(sqrt(5)-1)/2","0 zero"]'
    AND json_extract(data,'$.a')='C' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','乘法雜湊先乘常數 A、取小數部分，再乘表長向下取整。常用 A=(√5−1)/2，約 0.618，符合 0<A<1。若用 0、1 或 2，整數鍵乘完仍是整數，小數部分都為 0。','$.category','雜湊函數與設計'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-12' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='15f486ff-80ee-4b1e-8708-12384c94e777' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT 'c477d9be-c1ac-4a8b-bc8e-215a0c38f986',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-13' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='雜湊表的大小 m 若為質數，通常有助於？'
    AND json_extract(data,'$.type')='單選題' AND json(json_extract(data,'$.opts'))='["提高雜湊函數複雜度","降低搜尋速度","減少衝突","增加記憶體"]'
    AND json_extract(data,'$.a')='C' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','除法雜湊用 k mod m。若鍵常有共同因數，而 m 也含這個因數，餘數容易只落在少數槽。選適當質數能減少這種規律造成的碰撞；仍需看鍵的分布，質數也不會自行增加記憶體或降低搜尋速度。','$.category','雜湊函數與設計'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-13' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='c477d9be-c1ac-4a8b-bc8e-215a0c38f986' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT 'ed15327a-4381-476a-b777-d15851e0658f',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-11' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='雜湊函數 h(k) = floor(m(kA mod 1)) 屬於哪種方法？'
    AND json_extract(data,'$.type')='單選題' AND json(json_extract(data,'$.opts'))='["直接定址法 (Direct addressing)","除法雜湊法 (Division method)","乘法雜湊法 (Multiplication method)","全域雜湊法 (Universal hashing)"]'
    AND json_extract(data,'$.a')='C' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','先算 kA，再取 kA mod 1 的小數部分，乘上 m 後向下取整。這是乘法雜湊。除法法取的是 k mod m；直接定址用鍵直接定位；全域雜湊則描述如何選函數。','$.category','雜湊函數與設計'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-11' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='ed15327a-4381-476a-b777-d15851e0658f' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '80c213fc-f4bb-420c-b7e1-7506c74740c9',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-276edad2-8f62-43e9-b7cc-ff7216f423c6-2' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='若雜湊函數為 h(k) = k mod m，其中 m 為雜湊表大小，這種方法稱為？'
    AND json_extract(data,'$.type')='單選題' AND json(json_extract(data,'$.opts'))='["開放定址法 (Open addressing)","除法雜湊法 (Division method)","乘法雜湊法 (Multiplication method)","全域雜湊法 (Universal hashing)"]'
    AND json_extract(data,'$.a')='B' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','h(k)=k mod m 是除法雜湊法。開放定址說明發生碰撞後如何處理，與初始索引的計算法不同。乘法法取 kA 的小數部分，全域雜湊則從函數族中隨機選函數。','$.category','雜湊函數與設計'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-276edad2-8f62-43e9-b7cc-ff7216f423c6-2' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='80c213fc-f4bb-420c-b7e1-7506c74740c9' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '2541b36c-2915-4dd2-96e2-5d76ad164e33',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-15' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='雜湊函數的設計原則包含？'
    AND json_extract(data,'$.type')='多選題' AND json(json_extract(data,'$.opts'))='["減少衝突","僅使用加法","分布均勻","計算快速"]'
    AND json_extract(data,'$.a')='A、C、D' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','好的雜湊函數把鍵均勻分散，讓碰撞、桶長和探測次數降低，且每次算索引應夠快。可以使用取餘數、乘法或位元運算，沒有只能用加法的限制。','$.category','雜湊函數與設計'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-15' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='2541b36c-2915-4dd2-96e2-5d76ad164e33' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '7811e10e-a797-45eb-a55d-86664885e0a8',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-19' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='為什麼 m 選擇質數對除法雜湊法很重要？'
    AND json_extract(data,'$.type')='多選題' AND json(json_extract(data,'$.opts'))='["沒有任何幫助","提高運算效率","減少衝突","避免數值上的對稱性"]'
    AND json_extract(data,'$.a')='C、D' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','h(k)=k mod m 只看餘數。若 m=8 而鍵全是 8 的倍數，便都落在 0。選不容易與鍵規律共用因數的質數，可減少週期性集中和碰撞；取模運算本身未必更快。','$.category','雜湊函數與設計'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-19' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='7811e10e-a797-45eb-a55d-86664885e0a8' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT 'c4eb6b0f-3569-46ef-ac2c-ddfceb9fbe2e',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-10a5c455-d3b4-411e-8d5d-c96554917d48-4' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='雜湊函數 h(k) = k mod m 中的 m？'
    AND json_extract(data,'$.type')='多選題' AND json(json_extract(data,'$.opts'))='["影響分布效果","可以選擇質數","必須大於鍵值範圍","是雜湊表的大小"]'
    AND json_extract(data,'$.a')='A、B、D' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','m 是槽數。取餘數會把鍵分配到 0～m−1，所以 m 會影響分布，可選合適的質數。鍵值範圍可以遠大於 m；雜湊正是把大鍵值空間映射到較小的表。','$.category','雜湊函數與設計'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-10a5c455-d3b4-411e-8d5d-c96554917d48-4' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='c4eb6b0f-3569-46ef-ac2c-ddfceb9fbe2e' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT 'a720b17b-0349-42dd-ab6a-1bef667751e8',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-3' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='除法雜湊法的計算公式為 h(k) = k ____________ m (請用小寫英文回答)'
    AND json_extract(data,'$.type')='填空題' AND json(json_extract(data,'$.opts'))='[]'
    AND json_extract(data,'$.a')='mod' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','除法雜湊把 k 除以 m，將餘數用作索引，所以空格填 mod。例如 22 mod 11=0，應檢查第 0 格。','$.category','雜湊函數與設計'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-3' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='a720b17b-0349-42dd-ab6a-1bef667751e8' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '572922f2-26c1-4938-9a0e-28adc12b1fd8',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-17' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='雜湊表的效能很大程度上依賴於？'
    AND json_extract(data,'$.type')='單選題' AND json(json_extract(data,'$.opts'))='["探測的次數","記憶體大小","雜湊函數的均勻性","鏈結串列長度"]'
    AND json_extract(data,'$.a')='C' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','均勻分布能讓資料分散到各槽，避免所有鍵擠到一處。探測次數和鏈結串列長度是碰撞分布與處理方式的結果；記憶體大小會影響容量，也需要配合分布與負載。','$.category','負載因子與效能'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-17' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='572922f2-26c1-4938-9a0e-28adc12b1fd8' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '0f9a6226-6c8a-4cf8-bf09-1b67ed4e409e',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-20' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='雜湊表的負載因子（Load factor, α）定義為？'
    AND json_extract(data,'$.type')='單選題' AND json(json_extract(data,'$.opts'))='["n+m","m/n","n/m","n*m"]'
    AND json_extract(data,'$.a')='C' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','將 n 個元素平均分到 m 個槽，每槽平均 n/m 個，例如 10 個元素和 5 格的負載是 2。m/n 是其倒數，相加或相乘也沒有表示每槽平均值。','$.category','負載因子與效能'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-20' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='0f9a6226-6c8a-4cf8-bf09-1b67ed4e409e' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '91826efe-1f3f-4436-9b53-a55677fe68d3',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-6' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='關於雜湊表的平均效能，正確的有？'
    AND json_extract(data,'$.type')='多選題' AND json(json_extract(data,'$.opts'))='["完全不依賴輸入分布","與衝突解決機制有關","INSERT 預期為 O(1)","SEARCH 預期為 O(1+α)"]'
    AND json_extract(data,'$.a')='B、C、D' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','碰撞解法與雜湊分布都會影響成本。對均勻雜湊的鏈結法，平均桶長為 α，搜尋平均 O(1+α)；若允許直接插到串列開頭，插入 O(1)。開放定址或需要先檢查重複時，插入成本仍會受負載影響。','$.category','負載因子與效能'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-6' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='91826efe-1f3f-4436-9b53-a55677fe68d3' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT 'f84e4725-509a-4293-8202-016d9b2e68f1',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-10a5c455-d3b4-411e-8d5d-c96554917d48-2' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='關於雜湊表的負載因子 α，正確的有？'
    AND json_extract(data,'$.type')='多選題' AND json(json_extract(data,'$.opts'))='["開放定址法 α 必須小於 1","α = n/m","α 代表每個位置平均儲存的元素個數","鏈結法 α 可以大於 1"]'
    AND json_extract(data,'$.a')='A、B、C、D' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','α=n/m，表示把表內鍵數平均分到每個槽的數量。鏈結法允許每個槽接多個鍵，所以可超過 1。開放定址最多 α=1，但滿表時已不能插入；題庫的「小於 1」應讀為仍可插入、正常維持負載的條件。','$.category','負載因子與效能'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-10a5c455-d3b4-411e-8d5d-c96554917d48-2' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='f84e4725-509a-4293-8202-016d9b2e68f1' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '526e95bc-f143-484d-945c-1df36bb138d8',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-16' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='負載因子 α 定義為 ____________ 除以 m (請用小寫英文回答)'
    AND json_extract(data,'$.type')='填空題' AND json(json_extract(data,'$.opts'))='[]'
    AND json_extract(data,'$.a')='n' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','負載因子 α=n/m。n 是表內已存的鍵數，m 是表的槽數。例如 11 格放了 9 個鍵，α=9/11，因此分子填 n。','$.category','負載因子與效能'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-16' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='526e95bc-f143-484d-945c-1df36bb138d8' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '08ee54f6-e880-4d4b-8783-3543fc244d5e',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-7' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='雜湊表搜尋的平均複雜度為 ____________ (請用英文回答，表示形式為 請用log，不可用lg替代log，上標請用^，符號請用 {big-theta, theta, big-omega, omega, O, o,})'
    AND json_extract(data,'$.type')='填空題' AND json(json_extract(data,'$.opts'))='[]'
    AND json_extract(data,'$.a')='O(1)' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','在雜湊分布近似均勻、負載受控制時，平均只需檢查常數個位置或元素，因此填 O(1)。若資料集中到同一桶，仍可能要逐一搜尋，最壞情況可為 O(n)。','$.category','負載因子與效能'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-7' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='08ee54f6-e880-4d4b-8783-3543fc244d5e' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '066a1fd4-b7f3-4b5a-b660-91553489266f',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-276edad2-8f62-43e9-b7cc-ff7216f423c6-3' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='下列何者是解決雜湊衝突（Collision）的方法？'
    AND json_extract(data,'$.type')='單選題' AND json(json_extract(data,'$.opts'))='["二元搜尋 (Binary search)","鏈結法 (Chaining)","快速排序 (Quicksort)","動態規劃 (Dynamic programming)"]'
    AND json_extract(data,'$.a')='B' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','鏈結法把落到同一索引的鍵放在同一桶的串列裡，再依鍵比對。二元搜尋需有序資料，快速排序負責排列，動態規劃重用子問題結果，都不是本題的碰撞解法。','$.category','碰撞處理與鏈結法'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-276edad2-8f62-43e9-b7cc-ff7216f423c6-3' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='066a1fd4-b7f3-4b5a-b660-91553489266f' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '05f5f164-5908-44c7-a51c-5f220cc45915',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-10a5c455-d3b4-411e-8d5d-c96554917d48-5' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='在鏈結法中，若所有鍵值都雜湊到同一個位置，搜尋時間複雜度為？'
    AND json_extract(data,'$.type')='單選題' AND json(json_extract(data,'$.opts'))='["Θ(n)","Θ(1)","Θ(n²)","Θ(log n)"]'
    AND json_extract(data,'$.a')='A' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','所有鍵都落在同一桶時，該桶串列長度為 n。最壞要檢查整條串列，例如找不存在的鍵，成本為 Θ(n)。資料沒有排序或樹結構，無法做二分搜尋。','$.category','碰撞處理與鏈結法'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-10a5c455-d3b4-411e-8d5d-c96554917d48-5' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='05f5f164-5908-44c7-a51c-5f220cc45915' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '0b69246e-ea8a-48bd-9a4b-913fb6430665',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-16' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='解決雜湊衝突的技術有哪些？'
    AND json_extract(data,'$.type')='多選題' AND json(json_extract(data,'$.opts'))='["完全雜湊 (Perfect hashing)","鏈結法 (Chaining)","開放定址法 (Open addressing)","直接定址法 (Direct addressing)"]'
    AND json_extract(data,'$.a')='A、B、C' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','鏈結法把碰撞的鍵放在同一桶內；開放定址依探測序列另找位置。完全雜湊可為固定鍵集合建立無碰撞查找，典型二層設計會在碰撞的桶內配置次級表。直接定址每個鍵各一格，是用空間避開雜湊碰撞的另一種設計。','$.category','碰撞處理與鏈結法'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-16' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='0b69246e-ea8a-48bd-9a4b-913fb6430665' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '8a49e452-1281-44d5-918f-229199221ecb',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-2' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='雜湊技術中，常用的碰撞處理策略比較？'
    AND json_extract(data,'$.type')='多選題' AND json(json_extract(data,'$.opts'))='["鏈結法需要額外指標空間","開放定址法支援刪除操作較簡單","鏈結法適合處理高負載因子","開放定址法適合空間受限應用"]'
    AND json_extract(data,'$.a')='A、C、D' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','鏈結法需要節點與指標，同一桶可放多個鍵，所以 α 可以大於 1。開放定址把元素留在表內，省掉每個節點的指標，但仍要預留空槽，而且刪除通常需要標記，操作反而較複雜。','$.category','碰撞處理與鏈結法'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-2' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='8a49e452-1281-44d5-918f-229199221ecb' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '3c604302-51c5-429f-b522-835119bc0b46',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-15' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='下列何者是雜湊表刪除（Delete）操作的潛在問題？'
    AND json_extract(data,'$.type')='單選題' AND json(json_extract(data,'$.opts'))='["鏈結法會導致無窮迴圈","需要額外空間","排序陣列無法運作","開放定址法需標記已刪除位置"]'
    AND json_extract(data,'$.a')='D' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','開放定址搜尋遇到從未使用的空槽會停止。如果刪除時直接清空，後面因碰撞而移到其他槽的鍵可能找不到。留下「已刪除」標記可讓搜尋繼續，插入時則可重用該槽。','$.category','開放定址法'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-15' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='3c604302-51c5-429f-b522-835119bc0b46' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT 'fb603b25-f8d5-4c02-8888-813ca1fff3df',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-4' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='下列何者屬於開放定址法（Open addressing）？'
    AND json_extract(data,'$.type')='單選題' AND json(json_extract(data,'$.opts'))='["連結串列 (Linked list)","二元樹 (Binary tree)","桶排序 (Bucket sort)","線性探測 (Linear probing)"]'
    AND json_extract(data,'$.a')='D' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','線性探測發生碰撞後往下一格尋找空槽，所有鍵都留在原表內。鏈結串列常用於鏈結法；二元樹是一種資料結構；桶排序的目的是排序。','$.category','開放定址法'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-4' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='fb603b25-f8d5-4c02-8888-813ca1fff3df' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '9f3f3fc3-dc70-4d25-9f75-6a3c67b990d2',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-8' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='在開放定址法中，負載因子 α 必須滿足什麼條件？'
    AND json_extract(data,'$.type')='單選題' AND json(json_extract(data,'$.opts'))='["α > 1","α <= 1","α < 0","α = 0"]'
    AND json_extract(data,'$.a')='B' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','開放定址每格最多一個鍵，所以 n≤m，亦即 α≤1。α=1 表已滿，不能再插入，實務常在 α 明顯低於 1 時擴容。','$.category','開放定址法'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-8' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='9f3f3fc3-dc70-4d25-9f75-6a3c67b990d2' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '604270fc-1400-40a2-8268-9420e1730b05',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-10a5c455-d3b4-411e-8d5d-c96554917d48-6' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='在線性探測中，若發生衝突，下一個檢查的位置是？'
    AND json_extract(data,'$.type')='單選題' AND json(json_extract(data,'$.opts'))='["h(k, i+1) = (h(k, i) + 1) mod m","隨機位置","h(k, i) + i²","h(k, i) + i*h²(k)"]'
    AND json_extract(data,'$.a')='A' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','下一槽是 (目前槽+1) mod m。例如從第 m−1 格往前一格會繞回第 0 格。加平方位移屬二次探測，使用第二雜湊函數決定步長則是雙重雜湊。','$.category','線性探測'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-10a5c455-d3b4-411e-8d5d-c96554917d48-6' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='604270fc-1400-40a2-8268-9420e1730b05' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '885992b5-8c23-4bdf-a9c4-911de04c16d6',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-14' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='考慮將鍵值 10、22、31、4、15、28、17、88、59 插入長度 m = 11 的雜湊表A中，使用開放定址法（open addressing）與輔助雜湊函數 h''(k) = k。 

使用線性探測（linear probing） 請問陣列A[0] - A[10] 的內容哪些正確
| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|   |   |   |   |   |   |   |   |   |   |    |'
    AND json_extract(data,'$.type')='多選題' AND json(json_extract(data,'$.opts'))='["A[8]=59","A[0]=22","A[6]=28","A[3]=4"]'
    AND json_extract(data,'$.a')='A、B、C' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','依插入順序逐一處理。索引用 (k + i) mod 11，每個鍵都從 i=0 開始，遇到已佔槽便增加 i。

每個鍵的探測位置如下。若成功，箭頭最後一格就是插入位置。
10：10
22：0
31：9
4：4
15：4 → 5
28：6
17：6 → 7
88：0 → 1
59：4 → 5 → 6 → 7 → 8

由 A[0] 到 A[10] 依序為 22、88、空、空、4、15、28、17、59、31、10。

A[8]=59 正確。A[0]=22 正確。A[6]=28 正確。A[3]=4 不成立，A[3] 實際為 空。','$.category','線性探測'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-14' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='885992b5-8c23-4bdf-a9c4-911de04c16d6' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '57dfcaf1-34b9-4b50-9379-1c8f5ee04eef',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-2' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='考慮將鍵值 10、22、31、4、15、28、17、88、59 插入長度 m = 11 的雜湊表A中，使用開放定址法（open addressing）與輔助雜湊函數 h''(k) = k。 

使用線性探測（linear probing） 請問陣列A[0] - A[10] 的內容哪些正確
| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|   |   |   |   |   |   |   |   |   |   |    |'
    AND json_extract(data,'$.type')='多選題' AND json(json_extract(data,'$.opts'))='["A[9] = 10","A[8] = 59","A[4] = 15","A[6] = 28"]'
    AND json_extract(data,'$.a')='B、D' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','依插入順序逐一處理。索引用 (k + i) mod 11，每個鍵都從 i=0 開始，遇到已佔槽便增加 i。

每個鍵的探測位置如下。若成功，箭頭最後一格就是插入位置。
10：10
22：0
31：9
4：4
15：4 → 5
28：6
17：6 → 7
88：0 → 1
59：4 → 5 → 6 → 7 → 8

由 A[0] 到 A[10] 依序為 22、88、空、空、4、15、28、17、59、31、10。

A[9] = 10 不成立，A[9] 實際為 31。A[8] = 59 正確。A[4] = 15 不成立，A[4] 實際為 4。A[6] = 28 正確。','$.category','線性探測'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-2' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='57dfcaf1-34b9-4b50-9379-1c8f5ee04eef' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '0758549d-a911-44ac-9774-40670adc2b78',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-10' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='下列關於線性探測的敘述，正確的有？'
    AND json_extract(data,'$.type')='多選題' AND json(json_extract(data,'$.opts'))='["容易發生群聚效應 (Primary clustering)","在 α 接近 1 時效能急劇下降","是一種開放定址法","探測序列與關鍵字有關"]'
    AND json_extract(data,'$.a')='A、B、C' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','線性探測先用鍵決定起點，碰撞後固定每次前進一格，屬開放定址法。連續佔用區會吸收更多插入，形成一次群聚；α 接近 1 時空槽稀少，探測變長。若「探測序列與關鍵字有關」指起點則有關，本題答案採的是碰撞後位移規則固定的讀法。','$.category','線性探測'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-10' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='0758549d-a911-44ac-9774-40670adc2b78' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT 'd988350b-3f3f-4172-9611-039a431e06d1',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-9' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='考慮將鍵值 10、31、22、15、17、88、14、28、59 插入長度 m = 11 的雜湊表A中，使用開放定址法（open addressing）與輔助雜湊函數 h''(k) = k。 

線性探測（Linear Probing） 請問陣列A[0] - A[10] 的內容哪些正確
| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|   |   |   |   |   |   |   |   |   |   |    |

A[1] =   ____________ 
A[7] =   ____________'
    AND json_extract(data,'$.type')='填空題' AND json(json_extract(data,'$.opts'))='[]'
    AND json_extract(data,'$.a')='88/28' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','依插入順序逐一處理。索引用 (k + i) mod 11，每個鍵都從 i=0 開始，遇到已佔槽便增加 i。

每個鍵的探測位置如下。若成功，箭頭最後一格就是插入位置。
10：10
31：9
22：0
15：4
17：6
88：0 → 1
14：3
28：6 → 7
59：4 → 5

由 A[0] 到 A[10] 依序為 22、88、空、14、15、59、17、28、空、31、10。

依填空順序取值：A[1]=88，A[7]=28。','$.category','線性探測'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-9' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='d988350b-3f3f-4172-9611-039a431e06d1' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '3314fbc7-0a86-4d57-9c03-121f5ac50fff',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-10a5c455-d3b4-411e-8d5d-c96554917d48-1' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='考慮將鍵值 10、31、22、15、17、88、14、28、59 插入長度 m = 11 的雜湊表A中，使用開放定址法（open addressing）與輔助雜湊函數 h''(k) = k。 

線性探測（Linear Probing） 請問陣列A[0] - A[10] 的內容哪些正確
| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|   |   |   |   |   |   |   |   |   |   |    |

A[3] =   ____________ 
A[4] =   ____________'
    AND json_extract(data,'$.type')='填空題' AND json(json_extract(data,'$.opts'))='[]'
    AND json_extract(data,'$.a')='14/15' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','依插入順序逐一處理。索引用 (k + i) mod 11，每個鍵都從 i=0 開始，遇到已佔槽便增加 i。

每個鍵的探測位置如下。若成功，箭頭最後一格就是插入位置。
10：10
31：9
22：0
15：4
17：6
88：0 → 1
14：3
28：6 → 7
59：4 → 5

由 A[0] 到 A[10] 依序為 22、88、空、14、15、59、17、28、空、31、10。

依填空順序取值：A[3]=14，A[4]=15。','$.category','線性探測'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-10a5c455-d3b4-411e-8d5d-c96554917d48-1' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='3314fbc7-0a86-4d57-9c03-121f5ac50fff' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '04d32a5c-51ba-4bf7-9352-78eb2866bc49',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-f9039e48-7bcf-4904-8f32-47b554b961dd-2' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='考慮將鍵值 10、31、22、15、17、88、14、28、59 插入長度 m = 11 的雜湊表A中，使用開放定址法（open addressing）與輔助雜湊函數 h''(k) = k。 

線性探測（Linear Probing） 請問陣列A[0] - A[10] 的內容哪些正確
| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|   |   |   |   |   |   |   |   |   |   |    |

A[5] =   ____________ 
A[9] =   ____________'
    AND json_extract(data,'$.type')='填空題' AND json(json_extract(data,'$.opts'))='[]'
    AND json_extract(data,'$.a')='59/31' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','依插入順序逐一處理。索引用 (k + i) mod 11，每個鍵都從 i=0 開始，遇到已佔槽便增加 i。

每個鍵的探測位置如下。若成功，箭頭最後一格就是插入位置。
10：10
31：9
22：0
15：4
17：6
88：0 → 1
14：3
28：6 → 7
59：4 → 5

由 A[0] 到 A[10] 依序為 22、88、空、14、15、59、17、28、空、31、10。

依填空順序取值：A[5]=59，A[9]=31。','$.category','線性探測'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-f9039e48-7bcf-4904-8f32-47b554b961dd-2' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='04d32a5c-51ba-4bf7-9352-78eb2866bc49' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '7f29950f-c252-4857-a375-a4cc72d93911',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-5' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='開放定址法中的「二次探測（Quadratic probing）」的探測序列函數包含？'
    AND json_extract(data,'$.type')='單選題' AND json(json_extract(data,'$.opts'))='["i³","i²","i","log i"]'
    AND json_extract(data,'$.a')='B' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','二次探測以 c₁i+c₂i² 產生偏移，最具辨識力的是 i²。單獨使用 i 是線性位移；i³ 是三次；log i 不是這個公式。','$.category','二次探測'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-5' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='7f29950f-c252-4857-a375-a4cc72d93911' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT 'e2f71c01-e0ac-4cec-84bb-ce10f4b9505c',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-6' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='考慮將鍵值 10、22、31、4、15、28、17、88、59 插入長度 m = 11 的雜湊表A中，使用開放定址法（open addressing）與輔助雜湊函數 h''(k) = k。 

使用 c1 = 1 與 c2 = 3 的二次探測（quadratic probing） 請問陣列A[0] - A[10] 的內容哪些正確
| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|   |   |   |   |   |   |   |   |   |   |    |'
    AND json_extract(data,'$.type')='多選題' AND json(json_extract(data,'$.opts'))='["A[10]=10","A[5]=4","A[7]=59","A[9]=15"]'
    AND json_extract(data,'$.a')='A、C' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','依插入順序逐一處理。索引用 (k + 1i + 3i²) mod 11，每個鍵都從 i=0 開始，遇到已佔槽便增加 i。

每個鍵的探測位置如下。若成功，箭頭最後一格就是插入位置。
10：10
22：0
31：9
4：4
15：4 → 8
28：6
17：6 → 10 → 9 → 3
88：0 → 4 → 3 → 8 → 2
59：4 → 8 → 7

由 A[0] 到 A[10] 依序為 22、空、88、17、4、空、28、59、15、31、10。

A[10]=10 正確。A[5]=4 不成立，A[5] 實際為 空。A[7]=59 正確。A[9]=15 不成立，A[9] 實際為 31。','$.category','二次探測'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-6' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='e2f71c01-e0ac-4cec-84bb-ce10f4b9505c' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '611329af-963d-4fab-8ad9-912a3878947e',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-21' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='考慮將鍵值 10、31、22、15、17、88、14、28、59 插入長度 m = 11 的雜湊表A中，使用開放定址法（open addressing）與輔助雜湊函數 h''(k) = k。 

使用 c1 = 1 與 c2 = 3 的二次探測（quadratic probing） 請問陣列A[0] - A[10] 的內容哪些正確
| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|   |   |   |   |   |   |   |   |   |   |    |

A[3] =   ____________ 
A[4] =   ____________'
    AND json_extract(data,'$.type')='填空題' AND json(json_extract(data,'$.opts'))='[]'
    AND json_extract(data,'$.a')='88/15' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','依插入順序逐一處理。索引用 (k + 1i + 3i²) mod 11，每個鍵都從 i=0 開始，遇到已佔槽便增加 i。

每個鍵的探測位置如下。若成功，箭頭最後一格就是插入位置。
10：10
31：9
22：0
15：4
17：6
88：0 → 4 → 3
14：3 → 7
28：6 → 10 → 9 → 3 → 8
59：4 → 8 → 7 → 1

由 A[0] 到 A[10] 依序為 22、59、空、88、15、空、17、14、28、31、10。

依填空順序取值：A[3]=88，A[4]=15。','$.category','二次探測'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-21' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='611329af-963d-4fab-8ad9-912a3878947e' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '7bed6be4-517e-4239-8e4e-b6424406df20',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-1' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='考慮將鍵值 10、31、22、15、17、88、14、28、59 插入長度 m = 11 的雜湊表A中，使用開放定址法（open addressing）與輔助雜湊函數 h''(k) = k。 

使用 c1 = 1 與 c2 = 3 的二次探測（quadratic probing） 請問陣列A[0] - A[10] 的內容哪些正確
| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|   |   |   |   |   |   |   |   |   |   |    |

A[4] =   ____________ 
A[9] =   ____________'
    AND json_extract(data,'$.type')='填空題' AND json(json_extract(data,'$.opts'))='[]'
    AND json_extract(data,'$.a')='15/31' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','依插入順序逐一處理。索引用 (k + 1i + 3i²) mod 11，每個鍵都從 i=0 開始，遇到已佔槽便增加 i。

每個鍵的探測位置如下。若成功，箭頭最後一格就是插入位置。
10：10
31：9
22：0
15：4
17：6
88：0 → 4 → 3
14：3 → 7
28：6 → 10 → 9 → 3 → 8
59：4 → 8 → 7 → 1

由 A[0] 到 A[10] 依序為 22、59、空、88、15、空、17、14、28、31、10。

依填空順序取值：A[4]=15，A[9]=31。','$.category','二次探測'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-1' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='7bed6be4-517e-4239-8e4e-b6424406df20' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '4ada6741-af32-4b14-b31d-139e621ecab9',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-14' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='____________ 探測序列函數是 i^2 (請用小寫英文回答)'
    AND json_extract(data,'$.type')='填空題' AND json(json_extract(data,'$.opts'))='[]'
    AND json_extract(data,'$.a')='quadratic' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','quadratic 表示二次。典型位移是 c₁i+c₂i²，辨認點是 i² 項。題目以 i² 表示簡式；一般二次探測也可以同時有線性項。','$.category','二次探測'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-14' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='4ada6741-af32-4b14-b31d-139e621ecab9' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '518dd1f5-4293-4e44-be1a-e7f0ec12cef7',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-f9039e48-7bcf-4904-8f32-47b554b961dd-3' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='考慮將鍵值 10、31、22、15、17、88、14、28、59 插入長度 m = 11 的雜湊表A中，使用開放定址法（open addressing）與輔助雜湊函數 h''(k) = k。 

使用 c1 = 1 與 c2 = 3 的二次探測（quadratic probing） 請問陣列A[0] - A[10] 的內容哪些正確
| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|   |   |   |   |   |   |   |   |   |   |    |

A[1] =   ____________ 
A[8] =   ____________'
    AND json_extract(data,'$.type')='填空題' AND json(json_extract(data,'$.opts'))='[]'
    AND json_extract(data,'$.a')='59/28' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','依插入順序逐一處理。索引用 (k + 1i + 3i²) mod 11，每個鍵都從 i=0 開始，遇到已佔槽便增加 i。

每個鍵的探測位置如下。若成功，箭頭最後一格就是插入位置。
10：10
31：9
22：0
15：4
17：6
88：0 → 4 → 3
14：3 → 7
28：6 → 10 → 9 → 3 → 8
59：4 → 8 → 7 → 1

由 A[0] 到 A[10] 依序為 22、59、空、88、15、空、17、14、28、31、10。

依填空順序取值：A[1]=59，A[8]=28。','$.category','二次探測'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-f9039e48-7bcf-4904-8f32-47b554b961dd-3' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='518dd1f5-4293-4e44-be1a-e7f0ec12cef7' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '3ec74519-87b1-425f-8045-d44cc2b9980e',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-276edad2-8f62-43e9-b7cc-ff7216f423c6-6' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='雙重雜湊（Double hashing）的探測函數形式為？'
    AND json_extract(data,'$.type')='單選題' AND json(json_extract(data,'$.opts'))='["(h1(k) + i²) mod m","h1(k*i)","(h1(k) + i) mod m","(h1(k) + i*h²(k)) mod m"]'
    AND json_extract(data,'$.a')='D' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','雙重雜湊的公式是 (h₁(k)+i×h₂(k)) mod m。h₁ 決定起點，h₂ 決定此鍵的步長，i 是探測次數。選項的 h²(k) 依題意是在指第二個函數 h₂(k)；加 i 是線性探測，加 i² 是二次位移。','$.category','雙重雜湊'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-276edad2-8f62-43e9-b7cc-ff7216f423c6-6' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='3ec74519-87b1-425f-8045-d44cc2b9980e' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '6b0030b6-d944-49d0-8b98-29793a37f5e9',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-18' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='考慮將鍵值 10、22、31、4、15、28、17、88、59 插入長度 m = 11 的雜湊表A中，使用開放定址法（open addressing）與輔助雜湊函數 h''(k) = k。 

使用 h1(k) = k 和 h2(k) = 1 + (k mod (m - 1)) 的雙重雜湊（double hashing） 請問陣列A[0] - A[10] 的內容哪些正確
| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|   |   |   |   |   |   |   |   |   |   |    |'
    AND json_extract(data,'$.type')='多選題' AND json(json_extract(data,'$.opts'))='["A[4]=4","A[9]=10","A[7]=88","A[2]=59"]'
    AND json_extract(data,'$.a')='A、C、D' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','依插入順序逐一處理。索引用 (k + i×(1 + (k mod 10))) mod 11，每個鍵都從 i=0 開始，遇到已佔槽便增加 i。

每個鍵的探測位置如下。若成功，箭頭最後一格就是插入位置。
10：10
22：0
31：9
4：4
15：4 → 10 → 5
28：6
17：6 → 3
88：0 → 9 → 7
59：4 → 3 → 2

由 A[0] 到 A[10] 依序為 22、空、59、17、4、15、28、88、空、31、10。

A[4]=4 正確。A[9]=10 不成立，A[9] 實際為 31。A[7]=88 正確。A[2]=59 正確。','$.category','雙重雜湊'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-18' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='6b0030b6-d944-49d0-8b98-29793a37f5e9' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT 'f49fee7d-b252-4355-adec-42947c6d919b',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-9' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='雙重雜湊的探測序列優點？'
    AND json_extract(data,'$.type')='多選題' AND json(json_extract(data,'$.opts'))='["需要更多計算資源","減少二次群聚效應","能產生較長的探測序列","使用兩個雜湊函數"]'
    AND json_extract(data,'$.a')='B、C、D' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','第二個函數決定步長，讓起始槽相同的鍵也可能走不同路徑，減輕二次群聚。步長與表長互質時，探測可走遍整張表。使用兩個函數是這個方法的做法；額外計算則是成本。','$.category','雙重雜湊'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-9' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='f49fee7d-b252-4355-adec-42947c6d919b' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '34e4ea81-21c3-4f55-8057-586696cec7e7',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-276edad2-8f62-43e9-b7cc-ff7216f423c6-4' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='考慮將鍵值 10、22、31、4、15、28、17、88、59 插入長度 m = 11 的雜湊表A中，使用開放定址法（open addressing）與輔助雜湊函數 h''(k) = k。 

使用 h1(k) = k 和 h2(k) = 1 + (k mod (m - 1)) 的雙重雜湊（double hashing） 請問陣列A[0] - A[10] 的內容哪些正確
| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|   |   |   |   |   |   |   |   |   |   |    |'
    AND json_extract(data,'$.type')='多選題' AND json(json_extract(data,'$.opts'))='["A[3]=59","A[9]=17","A[6]=28","A[7]=88"]'
    AND json_extract(data,'$.a')='C、D' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','依插入順序逐一處理。索引用 (k + i×(1 + (k mod 10))) mod 11，每個鍵都從 i=0 開始，遇到已佔槽便增加 i。

每個鍵的探測位置如下。若成功，箭頭最後一格就是插入位置。
10：10
22：0
31：9
4：4
15：4 → 10 → 5
28：6
17：6 → 3
88：0 → 9 → 7
59：4 → 3 → 2

由 A[0] 到 A[10] 依序為 22、空、59、17、4、15、28、88、空、31、10。

A[3]=59 不成立，A[3] 實際為 17。A[9]=17 不成立，A[9] 實際為 31。A[6]=28 正確。A[7]=88 正確。','$.category','雙重雜湊'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-276edad2-8f62-43e9-b7cc-ff7216f423c6-4' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='34e4ea81-21c3-4f55-8057-586696cec7e7' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '89d662dc-cf05-4152-ba9c-a2b04332509b',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-1' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='考慮將鍵值 10、31、22、15、17、88、14、28、59 插入長度 m = 11 的雜湊表A中，使用開放定址法（open addressing）與輔助雜湊函數 h''(k) = k。 

使用 h1(k) = k 和 h2(k) = 1 + (k mod (m - 1)) 的雙重雜湊（double hashing） 請問陣列A[0] - A[10] 的內容哪些正確
| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|   |   |   |   |   |   |   |   |   |   |    |

A[1] =   ____________ 
A[6] =   ____________'
    AND json_extract(data,'$.type')='填空題' AND json(json_extract(data,'$.opts'))='[]'
    AND json_extract(data,'$.a')='59/17' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','依插入順序逐一處理。索引用 (k + i×(1 + (k mod 10))) mod 11，每個鍵都從 i=0 開始，遇到已佔槽便增加 i。

每個鍵的探測位置如下。若成功，箭頭最後一格就是插入位置。
10：10
31：9
22：0
15：4
17：6
88：0 → 9 → 7
14：3
28：6 → 4 → 2
59：4 → 3 → 2 → 1

由 A[0] 到 A[10] 依序為 22、59、28、14、15、空、17、88、空、31、10。

依填空順序取值：A[1]=59，A[6]=17。','$.category','雙重雜湊'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-1' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='89d662dc-cf05-4152-ba9c-a2b04332509b' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '85099edb-e9d5-4b5b-8679-b1e5764c5dcc',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-10' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='考慮將鍵值 10、31、22、15、17、88、14、28、59 插入長度 m = 11 的雜湊表A中，使用開放定址法（open addressing）與輔助雜湊函數 h''(k) = k。 

使用 h1(k) = k 和 h2(k) = 3 + (k mod (m - 1)) 的雙重雜湊（double hashing） 請問陣列A[0] - A[10] 的內容哪些正確
| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|   |   |   |   |   |   |   |   |   |   |    |

無法藉此公式找到合法位置 的數 (先填小的值再填大的值)
 ____________  ____________'
    AND json_extract(data,'$.type')='填空題' AND json(json_extract(data,'$.opts'))='[]'
    AND json_extract(data,'$.a')='28/88' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','依插入順序逐一處理。索引用 (k + i×(3 + (k mod 10))) mod 11，每個鍵都從 i=0 開始，遇到已佔槽便增加 i。

每個鍵的探測位置如下。若成功，箭頭最後一格就是插入位置。
10：10
31：9
22：0
15：4
17：6
88：探測 0，i=0～10 都找不到空槽
14：3
28：探測 6，i=0～10 都找不到空槽
59：4 → 5

由 A[0] 到 A[10] 依序為 22、空、空、14、15、59、17、空、空、31、10。

依小到大填 28/88。步長為 11 時，每次取模都回到同一格，表裡即使還有空槽也無法探測到。','$.category','雙重雜湊'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-10' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='85099edb-e9d5-4b5b-8679-b1e5764c5dcc' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '30aeb2bd-eb27-4741-ae6e-1421b1fd1f86',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-8' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='考慮將鍵值 10、31、22、15、17、88、14、28、59 插入長度 m = 11 的雜湊表A中，使用開放定址法（open addressing）與輔助雜湊函數 h''(k) = k。 

使用 h1(k) = k 和 h2(k) = 1 + (k mod (m - 1)) 的雙重雜湊（double hashing） 請問陣列A[0] - A[10] 的內容哪些正確
| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|   |   |   |   |   |   |   |   |   |   |    |

A[3] =   ____________ 
A[7] =   ____________'
    AND json_extract(data,'$.type')='填空題' AND json(json_extract(data,'$.opts'))='[]'
    AND json_extract(data,'$.a')='14/88' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','依插入順序逐一處理。索引用 (k + i×(1 + (k mod 10))) mod 11，每個鍵都從 i=0 開始，遇到已佔槽便增加 i。

每個鍵的探測位置如下。若成功，箭頭最後一格就是插入位置。
10：10
31：9
22：0
15：4
17：6
88：0 → 9 → 7
14：3
28：6 → 4 → 2
59：4 → 3 → 2 → 1

由 A[0] 到 A[10] 依序為 22、59、28、14、15、空、17、88、空、31、10。

依填空順序取值：A[3]=14，A[7]=88。','$.category','雙重雜湊'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-8' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='30aeb2bd-eb27-4741-ae6e-1421b1fd1f86' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '83486954-6a70-4f4f-a34d-37a7b45b88b5',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-7' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='考慮將鍵值 10、31、22、15、17、88、14、28、59 插入長度 m = 11 的雜湊表A中，使用開放定址法（open addressing）與輔助雜湊函數 h''(k) = k。 

使用 h1(k) = k 和 h2(k) = 3 + (k mod (m - 1)) 的雙重雜湊（double hashing） 請問陣列A[0] - A[10] 的內容哪些正確
| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|   |   |   |   |   |   |   |   |   |   |    |

A[4] =   ____________ 
A[9] =   ____________'
    AND json_extract(data,'$.type')='填空題' AND json(json_extract(data,'$.opts'))='[]'
    AND json_extract(data,'$.a')='15/31' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','依插入順序逐一處理。索引用 (k + i×(3 + (k mod 10))) mod 11，每個鍵都從 i=0 開始，遇到已佔槽便增加 i。

每個鍵的探測位置如下。若成功，箭頭最後一格就是插入位置。
10：10
31：9
22：0
15：4
17：6
88：探測 0，i=0～10 都找不到空槽
14：3
28：探測 6，i=0～10 都找不到空槽
59：4 → 5

由 A[0] 到 A[10] 依序為 22、空、空、14、15、59、17、空、空、31、10。

依填空順序取值：A[4]=15，A[9]=31。','$.category','雙重雜湊'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-195e73dc-491e-4a91-8c57-eb1d042735ab-7' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='83486954-6a70-4f4f-a34d-37a7b45b88b5' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT 'f003fbd9-a411-40a4-8480-5ef71c471190',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-276edad2-8f62-43e9-b7cc-ff7216f423c6-1' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='考慮將鍵值 10、31、22、15、17、88、14、28、59 插入長度 m = 11 的雜湊表A中，使用開放定址法（open addressing）與輔助雜湊函數 h''(k) = k。 

使用 h1(k) = k 和 h2(k) = 1 + (k mod (m - 1)) 的雙重雜湊（double hashing） 請問陣列A[0] - A[10] 的內容哪些正確
| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|   |   |   |   |   |   |   |   |   |   |    |

A[4] =   ____________ 
A[9] =   ____________'
    AND json_extract(data,'$.type')='填空題' AND json(json_extract(data,'$.opts'))='[]'
    AND json_extract(data,'$.a')='15/31' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','依插入順序逐一處理。索引用 (k + i×(1 + (k mod 10))) mod 11，每個鍵都從 i=0 開始，遇到已佔槽便增加 i。

每個鍵的探測位置如下。若成功，箭頭最後一格就是插入位置。
10：10
31：9
22：0
15：4
17：6
88：0 → 9 → 7
14：3
28：6 → 4 → 2
59：4 → 3 → 2 → 1

由 A[0] 到 A[10] 依序為 22、59、28、14、15、空、17、88、空、31、10。

依填空順序取值：A[4]=15，A[9]=31。','$.category','雙重雜湊'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-276edad2-8f62-43e9-b7cc-ff7216f423c6-1' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='f003fbd9-a411-40a4-8480-5ef71c471190' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT '1202c061-a301-453a-bf64-77cdbf00b96b',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-4' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='全域雜湊法（Universal hashing）的主要優點是？'
    AND json_extract(data,'$.type')='單選題' AND json(json_extract(data,'$.opts'))='["空間複雜度為 O(1)","減少衝突發生的機率","保證沒有衝突","不需要雜湊函數"]'
    AND json_extract(data,'$.a')='B' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','先從函數族隨機選 h。對任兩個不同的鍵，其碰撞機率可由函數族的性質約束，典型上界是 1/m。碰撞仍可能發生，表也必須配置空間並計算雜湊函數。','$.category','全域雜湊與完全雜湊'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-4a23f59b-43d2-4e9c-a5d2-21da60c16391-4' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='1202c061-a301-453a-bf64-77cdbf00b96b' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT 'beba3b6c-3f9a-44fc-a1d1-32c8b2caa81a',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-f9039e48-7bcf-4904-8f32-47b554b961dd-1' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='全域雜湊法（Universal hashing）具有什麼特徵？'
    AND json_extract(data,'$.type')='多選題' AND json(json_extract(data,'$.opts'))='["從函數族中隨機選擇雜湊函數","降低特定惡意輸入造成大量衝突的風險","需要儲存所有鍵值","對任意一組輸入都能達到平均效果"]'
    AND json_extract(data,'$.a')='A、B、D' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','建表時從全域函數族隨機選一支函數。對任意事先固定的一組輸入，平均是對「隨機選函數」取期望，因此可降低特定輸入造成大量碰撞的風險。這個性質不需要把整個鍵值空間存起來，也不保證每次選出的函數都同樣均勻。','$.category','全域雜湊與完全雜湊'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-f9039e48-7bcf-4904-8f32-47b554b961dd-1' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='beba3b6c-3f9a-44fc-a1d1-32c8b2caa81a' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);

INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT 'e6164f34-1ea8-4d58-b9df-c8e8f448d589',id,revision,course,unit,data,is_published,'update','站主管理','補上演算法 L9 解析與主題分類｜2026-11-26',unixepoch()*1000
    FROM public_questions WHERE id='community-276edad2-8f62-43e9-b7cc-ff7216f423c6-5' AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')='完全雜湊的搜尋時間在最壞情況下為 ____________ (請用英文回答，表示形式為 請用log，不可用lg替代log，上標請用^，符號請用 {big-theta, theta, big-omega, omega, O, o,})'
    AND json_extract(data,'$.type')='填空題' AND json(json_extract(data,'$.opts'))='[]'
    AND json_extract(data,'$.a')='O(1)' AND COALESCE(json_extract(data,'$.ex'),'')=''
    AND COALESCE(json_extract(data,'$.category'),'')='HTML 匯入';
  UPDATE public_questions AS q SET data=json_set(data,'$.ex','完全雜湊為固定的鍵集合建表。典型二層完全雜湊先計算第一層桶，再查第二層槽並比對鍵，只需固定次數，因此最壞搜尋 O(1)。建表成本與更新成本要另外算。','$.category','全域雜湊與完全雜湊'),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id='community-276edad2-8f62-43e9-b7cc-ff7216f423c6-5' AND EXISTS(SELECT 1 FROM question_history h WHERE h.id='e6164f34-1ea8-4d58-b9df-c8e8f448d589' AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);
