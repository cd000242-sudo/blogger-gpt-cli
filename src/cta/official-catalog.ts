
// src/cta/official-catalog.ts
export type OfficialLink = { txt: string; url: string; tags: string[]; weight?: number };

export const OFFICIAL_CATALOG: OfficialLink[] = [
  // ========== 정부/공공기관 ==========
  { txt: "정부24", url: "https://www.gov.kr", tags: ["정부","민원","증명","발급","신청","공공","행정"], weight: 5 },
  { txt: "정책브리핑", url: "https://www.korea.kr", tags: ["정책","보도자료","공지","정부","뉴스"], weight: 3 },
  { txt: "국가법령정보", url: "https://www.law.go.kr", tags: ["법령","시행령","고시","규정","법률"], weight: 3 },
  { txt: "복지로", url: "https://www.bokjiro.go.kr", tags: ["복지","지원금","돌봄","바우처","급여","신청","혜택"], weight: 5 },
  { txt: "보건복지부", url: "https://www.mohw.go.kr", tags: ["복지","보건","의료","지원금","정책","건강"] },
  { txt: "국민건강보험", url: "https://www.nhis.or.kr", tags: ["건강보험","자격","보험료","요양","의료"] },
  { txt: "장기요양보험", url: "https://www.longtermcare.or.kr", tags: ["장기요양","등급","돌봄","요양","노인"] },
  { txt: "국민연금", url: "https://www.nps.or.kr", tags: ["연금","국민연금","노후","가입","수급","은퇴"] },
  { txt: "금융감독원", url: "https://www.fss.or.kr", tags: ["금융","민원","사기","대출","카드","피해","보험"] },
  { txt: "한국소비자원", url: "https://www.kca.go.kr", tags: ["소비자","피해구제","분쟁조정","환불","교환"] },
  { txt: "과기정통부", url: "https://www.msit.go.kr", tags: ["통신","요금","전기통신","정책","휴대폰","인터넷"] },
  { txt: "KISA", url: "https://www.kisa.or.kr", tags: ["개인정보","보이스피싱","스미싱","보안","해킹"] },
  
  // ========== 교통/여행 ==========
  { txt: "SRT 예매", url: "https://etk.srail.kr", tags: ["srt","예매","좌석","발권","환불","취소","좌석변경","기차","여행"], weight: 8 },
  { txt: "코레일 예매", url: "https://www.letskorail.com", tags: ["코레일","ktx","예매","기차","철도","여행","할인"], weight: 8 },
  { txt: "대한항공", url: "https://www.koreanair.com", tags: ["항공","항공권","비행기","여행","해외","국내선","국제선"], weight: 7 },
  { txt: "아시아나항공", url: "https://flyasiana.com", tags: ["항공","항공권","비행기","여행","해외","국내선","국제선"], weight: 7 },
  { txt: "진에어", url: "https://www.jinair.com", tags: ["lcc","저가항공","항공권","진에어","비행기"], weight: 6 },
  { txt: "제주항공", url: "https://www.jejuair.net", tags: ["lcc","저가항공","항공권","제주항공","비행기"], weight: 6 },
  { txt: "티웨이항공", url: "https://www.twayair.com", tags: ["lcc","저가항공","항공권","티웨이","비행기"], weight: 6 },
  { txt: "에어부산", url: "https://www.airbusan.com", tags: ["lcc","저가항공","항공권","에어부산","비행기"], weight: 6 },
  { txt: "렌터카 비교", url: "https://www.lotterentacar.net", tags: ["렌터카","자동차","대여","여행","제주","완전자차"], weight: 6 },
  
  // ========== 쇼핑/백화점/이커머스 ==========
  { txt: "롯데백화점", url: "https://www.lotteshopping.com", tags: ["백화점","쇼핑","선물","선물세트","한우","명절","추석","설날","프리미엄","고급","브랜드","가격비교"], weight: 10 },
  { txt: "현대백화점", url: "https://www.ehyundai.com", tags: ["백화점","쇼핑","선물","선물세트","한우","명절","추석","설날","프리미엄","고급","브랜드","가격비교"], weight: 10 },
  { txt: "신세계백화점", url: "https://www.shinsegaemall.com", tags: ["백화점","쇼핑","선물","선물세트","한우","명절","추석","설날","프리미엄","고급","브랜드","가격비교"], weight: 10 },
  { txt: "롯데마트몰", url: "https://www.lottemart.com", tags: ["마트","대형마트","식품","생필품","한우","선물세트","할인","세일","장보기","신선식품"], weight: 9 },
  { txt: "이마트몰", url: "https://emart.ssg.com", tags: ["마트","대형마트","식품","생필품","한우","선물세트","할인","세일","장보기","신선식품"], weight: 9 },
  { txt: "홈플러스", url: "https://www.homeplus.co.kr", tags: ["마트","대형마트","식품","생필품","한우","선물세트","할인","세일","장보기","신선식품"], weight: 9 },
  { txt: "쿠팡", url: "https://www.coupang.com", tags: ["쇼핑","온라인","구매","배송","로켓배송","할인","선물","한우","세트","생필품","가전","식품","가격비교","최저가"], weight: 10 },
  { txt: "11번가", url: "https://www.11st.co.kr", tags: ["쇼핑","온라인","구매","할인","선물","한우","세트","가전","식품","가격비교","최저가"], weight: 8 },
  { txt: "G마켓", url: "https://www.gmarket.co.kr", tags: ["쇼핑","온라인","구매","할인","선물","한우","세트","가전","식품","가격비교","최저가"], weight: 8 },
  { txt: "SSG닷컴", url: "https://www.ssg.com", tags: ["신세계","쇼핑","선물","한우","세트","신선식품","식품","배송","이마트","가격비교"], weight: 9 },
  { txt: "네이버 쇼핑", url: "https://shopping.naver.com", tags: ["쇼핑","검색","비교","가격","최저가","리뷰","가격비교","할인"], weight: 9 },
  { txt: "다나와", url: "https://www.danawa.com", tags: ["가격비교","최저가","쇼핑","검색","전자기기","가전","컴퓨터","견적"], weight: 9 },
  { txt: "카카오쇼핑", url: "https://shopping.kakao.com", tags: ["쇼핑","선물","할인","카카오","배송","선물하기"], weight: 7 },
  { txt: "옥션", url: "https://www.auction.co.kr", tags: ["쇼핑","온라인","구매","할인","경매","중고"], weight: 6 },
  { txt: "티몬", url: "https://www.tmon.co.kr", tags: ["쇼핑","할인","특가","소셜커머스"], weight: 6 },
  { txt: "위메프", url: "https://www.wemakeprice.com", tags: ["쇼핑","할인","특가","소셜커머스"], weight: 6 },
  
  // ========== 식품/건강/뷰티 ==========
  { txt: "정관장 공식몰", url: "https://www.kgcshop.co.kr", tags: ["건강","홍삼","정관장","선물","건강식품","건강기능식품","명절","선물세트"], weight: 8 },
  { txt: "CJ제일제당", url: "https://www.cjthemarket.com", tags: ["식품","한우","선물세트","햄","가공식품","명절","스팸"], weight: 8 },
  { txt: "농협몰", url: "https://mall.nonghyup.com", tags: ["한우","과일","선물세트","농산물","식품","명절","추석","설날","신선식품"], weight: 10 },
  { txt: "GS프레시몰", url: "https://www.gsfresh.com", tags: ["신선식품","한우","과일","채소","식품","배송","마트"], weight: 8 },
  { txt: "마켓컬리", url: "https://www.kurly.com", tags: ["신선식품","한우","과일","채소","식품","새벽배송","프리미엄"], weight: 8 },
  { txt: "올리브영", url: "https://www.oliveyoung.co.kr", tags: ["화장품","뷰티","건강","선물","세트","코스메틱","스킨케어"], weight: 7 },
  { txt: "랄라블라", url: "https://www.lalavla.com", tags: ["화장품","뷰티","할인","면세점","코스메틱"], weight: 6 },
  { txt: "CJ온스타일", url: "https://display.cjonstyle.com", tags: ["홈쇼핑","쇼핑","선물","건강식품","가전","패션"], weight: 6 },
  { txt: "롯데홈쇼핑", url: "https://www.lotteimall.com", tags: ["홈쇼핑","쇼핑","선물","건강식품","가전","패션"], weight: 6 },
  { txt: "현대홈쇼핑", url: "https://www.hyundaihmall.com", tags: ["홈쇼핑","쇼핑","선물","건강식품","가전","패션"], weight: 6 },
  
  // ========== 금융/은행/카드 ==========
  { txt: "KB국민은행", url: "https://www.kbstar.com", tags: ["은행","금융","대출","적금","예금","통장","이체"], weight: 6 },
  { txt: "신한은행", url: "https://www.shinhan.com", tags: ["은행","금융","대출","적금","예금","통장","이체"], weight: 6 },
  { txt: "우리은행", url: "https://www.wooribank.com", tags: ["은행","금융","대출","적금","예금","통장","이체"], weight: 6 },
  { txt: "하나은행", url: "https://www.kebhana.com", tags: ["은행","금융","대출","적금","예금","통장","이체"], weight: 6 },
  { txt: "카카오뱅크", url: "https://www.kakaobank.com", tags: ["은행","금융","대출","적금","예금","통장","이체","모바일"], weight: 7 },
  { txt: "토스", url: "https://toss.im", tags: ["금융","송금","이체","대출","투자","카드","간편결제"], weight: 8 },
  { txt: "네이버페이", url: "https://pay.naver.com", tags: ["결제","포인트","쇼핑","간편결제","혜택"], weight: 6 },
  
  // ========== 통신/모바일 ==========
  { txt: "SKT 공식", url: "https://www.skt.com", tags: ["통신","휴대폰","요금제","스마트폰","개통","해지"], weight: 6 },
  { txt: "KT 공식", url: "https://www.kt.com", tags: ["통신","휴대폰","요금제","스마트폰","개통","해지","인터넷"], weight: 6 },
  { txt: "LG U+", url: "https://www.uplus.co.kr", tags: ["통신","휴대폰","요금제","스마트폰","개통","해지","인터넷"], weight: 6 },
  
  // ========== 부동산/주거 ==========
  { txt: "국토교통부", url: "https://www.molit.go.kr", tags: ["부동산","주택","청약","정책","임대"], weight: 5 },
  { txt: "청약홈", url: "https://www.applyhome.co.kr", tags: ["청약","아파트","분양","신청","주택"], weight: 8 },
  { txt: "부동산114", url: "https://www.r114.com", tags: ["부동산","매매","전세","월세","시세"], weight: 6 },
  { txt: "직방", url: "https://www.zigbang.com", tags: ["부동산","원룸","오피스텔","전세","월세"], weight: 6 },
  { txt: "다방", url: "https://www.dabangapp.com", tags: ["부동산","원룸","오피스텔","전세","월세"], weight: 6 },
  
  // ========== 교육/학습 ==========
  { txt: "교육부", url: "https://www.moe.go.kr", tags: ["교육","정책","학교","입시","대학"], weight: 4 },
  { txt: "나이스", url: "https://www.neis.go.kr", tags: ["학교","성적","출결","학생","교육"], weight: 5 },
  { txt: "대학어디가", url: "https://www.adiga.kr", tags: ["대학","입시","수시","정시","원서"], weight: 6 },
  { txt: "EBS", url: "https://www.ebs.co.kr", tags: ["교육","강의","인강","수능","초등","중등","고등"], weight: 5 },
  
  // ========== 취업/채용 ==========
  { txt: "사람인", url: "https://www.saramin.co.kr", tags: ["채용","구직","이력서","취업","일자리"], weight: 7 },
  { txt: "잡코리아", url: "https://www.jobkorea.co.kr", tags: ["채용","구직","이력서","취업","일자리"], weight: 7 },
  { txt: "워크넷", url: "https://www.work.go.kr", tags: ["고용","일자리","구직","채용","실업급여"], weight: 6 },
  { txt: "LinkedIn", url: "https://www.linkedin.com", tags: ["채용","구직","네트워킹","경력","글로벌"], weight: 5 },
  
  // ========== 엔터테인먼트/문화 ==========
  { txt: "예스24 티켓", url: "https://ticket.yes24.com", tags: ["공연","콘서트","뮤지컬","티켓","예매","문화"], weight: 6 },
  { txt: "인터파크 티켓", url: "https://tickets.interpark.com", tags: ["공연","스포츠","전시","티켓","예매","문화"], weight: 6 },
  { txt: "CGV", url: "https://www.cgv.co.kr", tags: ["영화","영화관","예매","극장"], weight: 5 },
  { txt: "메가박스", url: "https://www.megabox.co.kr", tags: ["영화","영화관","예매","극장"], weight: 5 },
  { txt: "롯데시네마", url: "https://www.lottecinema.co.kr", tags: ["영화","영화관","예매","극장"], weight: 5 },
  { txt: "네이버 영화", url: "https://movie.naver.com", tags: ["영화","정보","리뷰","평점","개봉"], weight: 5 },
  
  // ========== 배송/택배 ==========
  { txt: "CJ대한통운 택배", url: "https://www.cjlogistics.com/ko/tool/parcel/tracking", tags: ["택배","cj","대한통운","조회","배송","마감","추석","물류"], weight: 7 },
  { txt: "한진택배", url: "https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do", tags: ["택배","한진","조회","배송","마감","추석","물류"], weight: 7 },
  { txt: "로젠택배", url: "https://www.ilogen.com/web/personal/trace", tags: ["택배","로젠","조회","배송","마감","추석","물류"], weight: 7 },
  { txt: "우체국 택배", url: "https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm", tags: ["우체국","택배","조회","배송","우정사업","마감","물류"], weight: 6 },
  { txt: "롯데택배", url: "https://www.lotteglogis.com/home/reservation/tracking/linkView", tags: ["택배","롯데","조회","배송","마감","물류"], weight: 6 },
  
  // ========== 맛집/음식/배달 ==========
  { txt: "배달의민족", url: "https://www.baemin.com", tags: ["배달","음식","맛집","주문","쿠폰"], weight: 8 },
  { txt: "쿠팡이츠", url: "https://www.coupangeats.com", tags: ["배달","음식","맛집","주문","쿠폰"], weight: 8 },
  { txt: "요기요", url: "https://www.yogiyo.co.kr", tags: ["배달","음식","맛집","주문","쿠폰"], weight: 7 },
  { txt: "네이버 예약", url: "https://booking.naver.com", tags: ["예약","맛집","레스토랑","미용","병원"], weight: 6 },
  { txt: "카카오맵", url: "https://map.kakao.com", tags: ["지도","맛집","길찾기","주소","위치"], weight: 6 },
  
  // ========== 숙박/호텔/리조트 ==========
  { txt: "야놀자", url: "https://www.yanolja.com", tags: ["숙박","호텔","모텔","펜션","예약","여행"], weight: 8 },
  { txt: "여기어때", url: "https://www.goodchoice.kr", tags: ["숙박","호텔","모텔","펜션","예약","여행"], weight: 8 },
  { txt: "에어비앤비", url: "https://www.airbnb.co.kr", tags: ["숙박","호텔","민박","게스트하우스","여행"], weight: 7 },
  { txt: "호텔스컴바인", url: "https://www.hotelscombined.co.kr", tags: ["호텔","숙박","비교","예약","해외"], weight: 6 },
  
  // ========== 자동차/보험 ==========
  { txt: "현대자동차", url: "https://www.hyundai.com", tags: ["자동차","차량","구매","견적","시승"], weight: 6 },
  { txt: "기아자동차", url: "https://www.kia.com", tags: ["자동차","차량","구매","견적","시승"], weight: 6 },
  { txt: "삼성화재", url: "https://www.samsungfire.com", tags: ["보험","자동차보험","실손","암보험"], weight: 5 },
  { txt: "현대해상", url: "https://www.hi.co.kr", tags: ["보험","자동차보험","실손","암보험"], weight: 5 },
  { txt: "DB손해보험", url: "https://www.idbins.com", tags: ["보험","자동차보험","실손","암보험"], weight: 5 },
  
  // ========== 패션/의류 ==========
  { txt: "무신사", url: "https://www.musinsa.com", tags: ["패션","의류","쇼핑","브랜드","남성","여성","스트릿"], weight: 8 },
  { txt: "지그재그", url: "https://www.zigzag.kr", tags: ["패션","의류","쇼핑","여성","브랜드"], weight: 7 },
  { txt: "에이블리", url: "https://www.a-bly.com", tags: ["패션","의류","쇼핑","여성","브랜드"], weight: 6 },
  { txt: "29CM", url: "https://www.29cm.co.kr", tags: ["패션","의류","라이프스타일","브랜드"], weight: 6 },
  
  // ========== IT/전자/가전 ==========
  { txt: "삼성전자", url: "https://www.samsung.com/kr", tags: ["전자","가전","스마트폰","갤럭시","tv","냉장고"], weight: 7 },
  { txt: "LG전자", url: "https://www.lge.co.kr", tags: ["전자","가전","스마트폰","tv","냉장고","세탁기"], weight: 7 },
  { txt: "Apple Korea", url: "https://www.apple.com/kr", tags: ["애플","아이폰","맥북","아이패드","전자기기"], weight: 7 },
  { txt: "다나와", url: "https://www.danawa.com", tags: ["가격비교","컴퓨터","전자기기","최저가","견적"], weight: 7 },
  { txt: "컴퓨존", url: "https://www.compuzone.co.kr", tags: ["컴퓨터","조립pc","견적","부품"], weight: 5 },
  
  // ========== 스포츠/레저 ==========
  { txt: "스포츠서울", url: "https://www.sportsseoul.com", tags: ["스포츠","뉴스","축구","야구","농구"], weight: 4 },
  { txt: "네이버 스포츠", url: "https://sports.news.naver.com", tags: ["스포츠","뉴스","경기","중계","일정"], weight: 6 },
  { txt: "골프존", url: "https://www.golfzon.com", tags: ["골프","스크린골프","예약","레슨"], weight: 5 },
  
  // ========== 뉴스/미디어 ==========
  { txt: "네이버 뉴스", url: "https://news.naver.com", tags: ["뉴스","시사","정치","경제","사회"], weight: 6 },
  { txt: "다음 뉴스", url: "https://news.daum.net", tags: ["뉴스","시사","정치","경제","사회"], weight: 5 },
  { txt: "조선일보", url: "https://www.chosun.com", tags: ["뉴스","신문","시사","정치"], weight: 4 },
  { txt: "중앙일보", url: "https://www.joongang.co.kr", tags: ["뉴스","신문","시사","정치"], weight: 4 },
  
  // ========== 생활/커뮤니티 ==========
  { txt: "네이버 카페", url: "https://section.cafe.naver.com", tags: ["커뮤니티","모임","정보","공유","후기"], weight: 5 },
  { txt: "디시인사이드", url: "https://www.dcinside.com", tags: ["커뮤니티","갤러리","정보","후기"], weight: 5 },
  { txt: "클리앙", url: "https://www.clien.net", tags: ["커뮤니티","it","정보","후기","모임"], weight: 5 },
  { txt: "에펨코리아", url: "https://www.fmkorea.com", tags: ["커뮤니티","축구","스포츠","정보","유머"], weight: 4 },
  
  // ========== 공과금/생활 ==========
  { txt: "한국전력", url: "https://cyber.kepco.co.kr", tags: ["전기","요금","고지서","납부","공과금"], weight: 6 },
  { txt: "서울시 상수도", url: "https://arisu.seoul.go.kr", tags: ["수도","요금","고지서","납부","공과금"], weight: 5 },
  { txt: "도시가스", url: "https://www.seoulgas.co.kr", tags: ["가스","요금","고지서","납부","공과금"], weight: 5 },
  
  // ========== 병원/의료/건강 ==========
  { txt: "서울아산병원", url: "https://www.amc.seoul.kr", tags: ["병원","의료","진료","예약","건강검진","암"], weight: 6 },
  { txt: "서울대병원", url: "https://www.snuh.org", tags: ["병원","의료","진료","예약","건강검진","암"], weight: 6 },
  { txt: "삼성서울병원", url: "https://www.samsunghospital.com", tags: ["병원","의료","진료","예약","건강검진","암"], weight: 6 },
  { txt: "세브란스병원", url: "https://www.yuhs.or.kr", tags: ["병원","의료","진료","예약","건강검진","암"], weight: 6 },
  { txt: "건강보험심사평가원", url: "https://www.hira.or.kr", tags: ["의료비","병원","평가","진료비","약값"], weight: 5 },
  
  // ========== 게임/엔터테인먼트 ==========
  { txt: "스팀", url: "https://store.steampowered.com", tags: ["게임","pc게임","할인","구매"], weight: 7 },
  { txt: "넷플릭스", url: "https://www.netflix.com/kr", tags: ["영화","드라마","ott","스트리밍","구독"], weight: 8 },
  { txt: "디즈니플러스", url: "https://www.disneyplus.com", tags: ["영화","드라마","ott","스트리밍","구독"], weight: 7 },
  { txt: "티빙", url: "https://www.tving.com", tags: ["영화","드라마","ott","스트리밍","구독","방송"], weight: 7 },
  { txt: "웨이브", url: "https://www.wavve.com", tags: ["영화","드라마","ott","스트리밍","구독","방송"], weight: 7 },
  { txt: "왓챠", url: "https://watcha.com", tags: ["영화","드라마","ott","스트리밍","구독"], weight: 6 },
  
  // ========== 반려동물/펫 ==========
  { txt: "펫프렌즈", url: "https://www.petfriends.co.kr", tags: ["반려동물","강아지","고양이","사료","용품","펫"], weight: 7 },
  { txt: "지마켓펫", url: "https://pet.gmarket.co.kr", tags: ["반려동물","강아지","고양이","사료","용품","펫"], weight: 6 },
  
  // ========== 육아/출산/유아 ==========
  { txt: "베이비페어", url: "https://www.babyfair.co.kr", tags: ["육아","유아","출산","아기","용품","분유"], weight: 7 },
  { txt: "토이저러스", url: "https://www.toysrus.co.kr", tags: ["장난감","유아","아기","완구","키즈"], weight: 6 },
  
  // ========== 가구/인테리어/리빙 ==========
  { txt: "이케아", url: "https://www.ikea.com/kr", tags: ["가구","인테리어","리빙","생활용품","침대","책상"], weight: 7 },
  { txt: "한샘", url: "https://www.hanssem.com", tags: ["가구","인테리어","리빙","주방","붙박이장"], weight: 6 },
  { txt: "오늘의집", url: "https://ohou.se", tags: ["인테리어","가구","리빙","집꾸미기","소품"], weight: 7 },
  
  // ========== 도서/문구/교육 ==========
  { txt: "예스24", url: "https://www.yes24.com", tags: ["책","도서","교보문고","베스트셀러","소설","ebook"], weight: 7 },
  { txt: "교보문고", url: "https://www.kyobobook.co.kr", tags: ["책","도서","베스트셀러","소설","ebook"], weight: 7 },
  { txt: "알라딘", url: "https://www.aladin.co.kr", tags: ["책","도서","중고책","베스트셀러","소설"], weight: 6 },
  { txt: "밀리의서재", url: "https://www.millie.co.kr", tags: ["전자책","ebook","구독","독서","오디오북"], weight: 6 },
  
  // ========== 중고거래/플리마켓 ==========
  { txt: "중고나라", url: "https://www.joonggonara.co.kr", tags: ["중고","거래","판매","구매","중고거래"], weight: 6 },
  { txt: "번개장터", url: "https://www.bunjang.co.kr", tags: ["중고","거래","판매","구매","중고거래","패션"], weight: 7 },
  { txt: "당근마켓", url: "https://www.daangn.com", tags: ["중고","거래","동네","지역","중고거래"], weight: 8 },
  
  // ========== 꽃/화환/선물 ==========
  { txt: "플라워365", url: "https://www.flower365.co.kr", tags: ["꽃","화환","꽃배달","축하","선물","결혼","장례"], weight: 7 },
  { txt: "꽃집청년들", url: "https://www.kukkaday.com", tags: ["꽃","꽃배달","선물","생일","축하"], weight: 6 },
  
  // ========== 여행/항공권/숙박 플랫폼 ==========
  { txt: "네이버 항공권", url: "https://flight.naver.com", tags: ["항공권","비행기","여행","비교","최저가"], weight: 8 },
  { txt: "스카이스캐너", url: "https://www.skyscanner.co.kr", tags: ["항공권","비행기","여행","비교","최저가","해외"], weight: 7 },
  { txt: "카약", url: "https://www.kayak.co.kr", tags: ["항공권","호텔","렌터카","여행","비교"], weight: 6 },
  { txt: "트리플", url: "https://www.triple.guide", tags: ["여행","일정","가이드","추천","해외여행"], weight: 6 },
  { txt: "마이리얼트립", url: "https://www.myrealtrip.com", tags: ["여행","투어","액티비티","숙박","항공권"], weight: 7 },
  
  // ========== 배달앱/음식 플랫폼 ==========
  { txt: "배달의민족", url: "https://www.baemin.com", tags: ["배달","음식","맛집","주문","쿠폰","치킨","피자"], weight: 9 },
  { txt: "쿠팡이츠", url: "https://www.coupangeats.com", tags: ["배달","음식","맛집","주문","쿠폰","치킨","피자"], weight: 9 },
  { txt: "요기요", url: "https://www.yogiyo.co.kr", tags: ["배달","음식","맛집","주문","쿠폰","치킨","피자"], weight: 8 },
  
  // ========== 생활서비스/플랫폼 ==========
  { txt: "카카오 T", url: "https://www.kakaomobility.com", tags: ["택시","대리운전","주차","이동","카카오택시"], weight: 7 },
  { txt: "타다", url: "https://tadatada.com", tags: ["택시","이동","호출","카풀"], weight: 5 },
  { txt: "숨고", url: "https://soomgo.com", tags: ["전문가","청소","이사","수리","레슨","서비스"], weight: 7 },
  { txt: "헬프미", url: "https://www.helpme.co.kr", tags: ["청소","이사","수리","서비스","생활"], weight: 6 },
  
  // ========== 자동차/모빌리티 ==========
  { txt: "SK엔카", url: "https://www.encar.com", tags: ["중고차","자동차","매매","시세","차량"], weight: 7 },
  { txt: "KB차차차", url: "https://www.kbchachacha.com", tags: ["중고차","자동차","매매","시세","차량"], weight: 6 },
  { txt: "카카오모빌리티", url: "https://www.kakaomobility.com", tags: ["택시","대리운전","주차","카풀"], weight: 6 },
  
  // ========== 운동/헬스/피트니스 ==========
  { txt: "스포티파이", url: "https://www.spotify.com", tags: ["음악","스트리밍","운동","플레이리스트"], weight: 6 },
  { txt: "유튜브 뮤직", url: "https://music.youtube.com", tags: ["음악","스트리밍","운동","플레이리스트"], weight: 6 },
  { txt: "멜론", url: "https://www.melon.com", tags: ["음악","스트리밍","kpop","플레이리스트"], weight: 6 },
  
  // ========== 공공서비스/민원 ==========
  { txt: "경찰청", url: "https://www.police.go.kr", tags: ["경찰","민원","분실물","신고","범죄"], weight: 5 },
  { txt: "소방청", url: "https://www.nfa.go.kr", tags: ["소방","안전","화재","구조"], weight: 4 },
  { txt: "119안전신고", url: "https://www.119.go.kr", tags: ["응급","신고","구조","안전"], weight: 5 },
  { txt: "기상청", url: "https://www.kma.go.kr", tags: ["날씨","기상","예보","태풍","미세먼지"], weight: 6 },
  { txt: "환경부", url: "https://www.me.go.kr", tags: ["환경","미세먼지","대기질","기후"], weight: 4 },
  
  // ========== 세금/국세/지방세 ==========
  { txt: "국세청 홈택스", url: "https://www.hometax.go.kr", tags: ["세금","종합소득세","연말정산","부가세","신고","환급"], weight: 8 },
  { txt: "위택스", url: "https://www.wetax.go.kr", tags: ["지방세","재산세","자동차세","세금","납부"], weight: 7 },
  
  // ========== 전자제품/가전 특화 ==========
  { txt: "하이마트", url: "https://www.himart.co.kr", tags: ["가전","전자제품","냉장고","세탁기","tv","에어컨"], weight: 7 },
  { txt: "전자랜드", url: "https://www.etland.co.kr", tags: ["가전","전자제품","냉장고","세탁기","tv","에어컨"], weight: 6 },
  
  // ========== 명절/선물 특화 ==========
  { txt: "CJ 선물세트", url: "https://www.cjthemarket.com/pc/giftset", tags: ["명절","추석","설날","선물세트","한우","햄","스팸","과일"], weight: 10 },
  { txt: "롯데 선물세트", url: "https://www.lotteon.com", tags: ["명절","추석","설날","선물세트","한우","과일","건강식품"], weight: 10 },
  
  // ========== 생활용품/가정 ==========
  { txt: "다이소", url: "https://www.daiso.co.kr", tags: ["생활용품","잡화","문구","주방","수납"], weight: 6 },
  { txt: "다이소몰", url: "https://www.daisomall.co.kr", tags: ["생활용품","잡화","문구","주방","수납"], weight: 6 },
  
  // ========== 차량정비/관리 ==========
  { txt: "카닥", url: "https://www.cardoc.co.kr", tags: ["자동차","정비","수리","차량관리","견적"], weight: 6 },
  { txt: "불스원", url: "https://www.bullsone.com", tags: ["자동차","용품","세차","관리"], weight: 5 },
  
  // ========== 아웃도어/캠핑/등산 ==========
  { txt: "코오롱스포츠", url: "https://www.kolonsport.com", tags: ["아웃도어","등산","캠핑","의류","용품"], weight: 6 },
  { txt: "블랙야크", url: "https://www.blackyak.com", tags: ["아웃도어","등산","캠핑","의류","용품"], weight: 5 },
  
  // ========== 주류/와인/음료 ==========
  { txt: "와인21", url: "https://www.wine21.com", tags: ["와인","주류","선물","양주","위스키"], weight: 6 },
  { txt: "롯데주류", url: "https://www.lotteliquor.com", tags: ["주류","와인","위스키","선물","양주"], weight: 6 },
  
  // ========== 프랜차이즈/외식 ==========
  { txt: "맥도날드", url: "https://www.mcdonalds.co.kr", tags: ["패스트푸드","햄버거","배달","쿠폰"], weight: 5 },
  { txt: "KFC", url: "https://www.kfckorea.com", tags: ["치킨","패스트푸드","배달","쿠폰"], weight: 5 },
  { txt: "롯데리아", url: "https://www.lotteria.com", tags: ["햄버거","패스트푸드","배달","쿠폰"], weight: 5 },
  { txt: "스타벅스", url: "https://www.starbucks.co.kr", tags: ["커피","카페","음료","선물","기프트카드"], weight: 7 },
  { txt: "이디야", url: "https://www.ediya.com", tags: ["커피","카페","음료","할인"], weight: 5 },
  
  // ========== 편의점/GS25/CU/세븐일레븐 ==========
  { txt: "GS25", url: "https://gs25.gsretail.com", tags: ["편의점","택배","배달","상품","쿠폰","gs25"], weight: 6 },
  { txt: "CU", url: "https://cu.bgfretail.com", tags: ["편의점","택배","배달","상품","쿠폰","cu"], weight: 6 },
  { txt: "세븐일레븐", url: "https://www.7-eleven.co.kr", tags: ["편의점","택배","배달","상품","쿠폰","711"], weight: 6 },
  
  // ========== 예약/티켓/플랫폼 ==========
  { txt: "네이버 예약", url: "https://booking.naver.com", tags: ["예약","맛집","레스토랑","미용실","병원","서비스"], weight: 7 },
  { txt: "카카오맵", url: "https://map.kakao.com", tags: ["지도","맛집","길찾기","주소","위치","검색"], weight: 7 },
  { txt: "네이버 지도", url: "https://map.naver.com", tags: ["지도","맛집","길찾기","주소","위치","검색"], weight: 7 },
  
  // ========== 부가서비스/생활편의 ==========
  { txt: "카카오톡", url: "https://www.kakaocorp.com/page/service/service/KakaoTalk", tags: ["메신저","채팅","소통","카카오"], weight: 5 },
  { txt: "라인", url: "https://line.me/ko", tags: ["메신저","채팅","소통"], weight: 4 },
  { txt: "우편번호 검색", url: "https://www.epost.go.kr/search.RetrieveIntegrationNewZipCdList.comm", tags: ["우편번호","주소","검색","우체국"], weight: 5 }
] as const;
