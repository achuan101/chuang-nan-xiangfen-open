# -*- coding: utf-8 -*-
"""
patch_dialogues.py: Appends missing unique dialogues to bring each guest list to exactly 100 lines.
"""

EXTRA_DIALOGUES = {
    "guest_walk": [
        "沿河散步时遇见熟人寒暄，身上有这一缕清气，整个人都神采奕奕。"
    ],
    "guest_student": [
        "下课铃声响起，合上书本，闻着指尖的花香，脚步轻快地走向归途。",
        "想找一味像初夏栀子初放时的清甜，给温热的书房带来一抹清凉花意。",
        "在花笺上写下心仪的词句，字迹娟秀，花香四溢，是少女最好的年华。",
        "和同窗约在南轩温书，桌角摆上一小瓶粉桃香水，满室生香，其乐融融。",
        "翻开厚重的词典，纸张沉静，若是夹着一抹鲜嫩的花息，便觉温情脉脉。"
    ],
    "guest_tea": [
        "深山古茶园里的青苔与老树共生，散发出一股饱经风霜的草木苍润之香。",
        "春水初煎谷雨茶，席间一缕嫩草香，足以涤尽平生尘土烦扰。",
        "走过雨后的茶垄，裤脚沾湿了露水与草叶，那股生津回甘之韵让人流连忘返。",
        "老茶人挑剔至极，不合心意的香绝不沾身，但对这味青草纯香却赞不绝口。",
        "用紫砂急须壶瀹泡高山乌龙，若有青翠草香相伴，茶汤香气更显高远。",
        "山间石缝里长出的野茶苗，叶片厚实挺拔，那股草木本真最有生机。",
        "江南春茶季虽短，但若能把这草木灵性封存在瓶中，便能四季常品春茶之味。",
        "在茶道中，草木既是媒介也是知己，这瓶调香真正抓住了茶人的魂魄所在。",
        "雨前龙井以嫩叶草香见长，若是调香也能有这般豆香嫩草底蕴，堪称神作。",
        "茶室挂一幅‘茶禅一味’的横批，桌上一盏清茶、一缕草香，万念俱寂。",
        "走遍万水千山寻茶，最贪恋的仍是清晨采茶尖那一抹未经雕琢的露珠草芳。"
    ],
    "guest_commuter": [
        "投宿野渡客栈，江风吹得窗纸作响，手边有这味沉静之香，方觉孤舟不冷。",
        "走过几百里官道，双脚磨起了水泡，闻着幽微沉香，心里的焦躁慢慢抚平。",
        "深夜盘点行囊里的票据，账目理清之后，在沉静中长长地吸一口气，踏实多了。",
        "出门在外的游子，最怕夜深思乡，这抹沉稳温润的香调就像故乡温暖的怀抱。",
        "赶不上城门落锁，只能在城外农家借宿，这静香驱散了一夜的荒凉孤寂。",
        "跑码头的日子苦中有乐，难得在南窗歇歇脚，让奔波的身心彻底归于平静。",
        "长亭连短亭，何处是归程？无论走到天涯海角，这抹沉静都是我安神的良方。",
        "长夜漫漫，伴着这悠远静谧的香气入梦，明早醒来又是一条好汉。",
        "人生的路很长，有时候走得太急太累，停下来闻一闻静香，才知生活的美好。",
        "外面的世界繁花似锦却凶险万分，进门闻得这味沉静，才觉平安归来是最大福分。",
        "在烛光下擦拭长途跋涉的马靴，满屋沉香弥漫，疲倦的身躯逐渐重获活力。",
        "夜行旅人如同疲惫的飞鸟，南窗就是为我们遮风挡雨的一方温暖静枝。",
        "风餐露宿是常事，只要这行囊深处藏着这一瓶静香，再颠簸的旅途也不惧怕。",
        "长街微雨，客舍青灯，闻着沉静的调子写家书，字里行间尽是平安温存。",
        "卸下背上的行囊，如同卸下一生的重担，沉香如定海神针，让心神永驻安宁。",
        "夜半听更夫敲梆，更尽漏残，沉静之香伴我沉入无梦的好觉，何等惬意自如。"
    ],
    "guest_afternoon": [
        "大雪天围着小铜炉烤年糕，米香焦黄，手心里握着掌柜调的暖香，整天都不冷。",
        "小巷人家炊烟袅袅，推开院门就是热腾腾的饭菜，人活一世，要的就是这股暖意。"
    ],
    "guest_night": [
        "弄堂深处传来一声长长的叫卖糖炒栗子声，夜风带着焦甜，让人心里暖洋洋的。",
        "倚在石桥栏杆上看水波里的倒影，晚星闪烁，身旁的夜调芬芳如水流淌。",
        "夜深了，街坊各回各家，关门闭户声接连响起，小巷在夜香中安然入眠。",
        "夏天夜里喝一碗井水镇过的乌梅汤，酸甜冰爽，晚风一吹，暑意全消。",
        "在临河的石阶上坐到半夜，看露水渐渐打湿石栏，满身尽是夜色的柔情。",
        "夏夜听雨打芭蕉，清凉透骨，伴着床头这一缕夜调，最容易沉沉入梦。",
        "河边的芦苇在晚风中轻轻摇曳，月光照在水草上，泛出幽幽的蓝绿光晕。",
        "街坊邻里在槐树底下话当年，笑声回荡在寂静夜空，夜色因此变得格外深情。",
        "夜露微凉，衣衫渐薄，但只要有这缕贴心的夜香萦绕，只觉得身心舒畅自在。",
        "在院子里搭一张竹凉床，仰望漫天繁星，耳边微风送来南窗铺子的幽雅香息。",
        "天热夜长，手摇一把蒲扇漫步长街，有这抹清凉夜调相伴，夏夜再无烦闷。"
    ],
    "guest_flower": [
        "白瓷盆里供养一丛含苞待放的水仙，金盏银台，清气扑鼻，最显案头雅致。",
        "刚给院里的玉兰花松了松泥土，春阳照在花瓣上，满园皆是纯洁无瑕的花光。",
        "把修剪下来的茉莉花串成小花圈戴在腕间，举手投足尽是江南女儿的柔婉。",
        "插花时讲究留出枝叶的呼吸间隙，调香亦然，这瓶花调层次分明，疏密有致。",
        "晨光熹微时采下一捧挂霜的蓝雪花，淡蓝如梦，水灵灵的香韵叫人心醉。",
        "在书案前摆一小尊紫砂花插，斜插一枝初绽山桃，水汽氤氲，满室春意盎然。",
        "秋日后园的木犀花开如粟，金黄灿烂，风过处，落花如雨，满衣皆是甜香。",
        "侍花弄草最是修身养性，见花如见故人，花开花谢皆是天地间最动人的诗篇。",
        "雨水打湿了院角开得正盛的凤仙花，粉红的花瓣在绿叶丛中更显娇艳欲滴。",
        "用宣纸吸干花瓣上多余的水分制成压花书签，将这一抹水灵灵的花容永驻心间。",
        "掌柜调制的花调鲜活灵动，就像把清晨五点钟整座带露后花园全装进了琉璃瓶。"
    ],
    "guest_artisan": [
        "老松木锯口渗出的琥珀色松脂，在阳光下散发着凛冽纯正的大山森林气息。",
        "给老书架重新修整榫头，严丝合缝敲打进去，整座书架稳固如初，木香扑面。",
        "用马尾毛刷细细扫去木雕缝隙里的木屑，黄杨木的温润光泽逐渐在手底显现。",
        "木工案板上的墨斗线印下了几十年的匠人心血，木头磨平了，初心始终如铁。",
        "新打好一套樟木小抽屉，拉开合上顺滑无声，浓郁的樟木香让人心神安宁。",
        "深冬在工坊里生火取暖，顺手扔几块柏木边角料进炉膛，满室尽是古柏苍劲清香。",
        "做手工木勺需用致密的梨木，木质细腻不吸水，握在掌心满是老木头的温存。",
        "木头是有灵性的生命，匠人赋予它新的形态，它便以百年不腐的沉香回馈人间。",
        "雕刻花鸟木挂件讲究下刀利落，木花纷飞之间，一幅生动的江南画卷跃然木上。",
        "在窗前擦拭用了三十年的老刨子，铁刃如雪，木身油润，这是老工匠最好的老伙计。",
        "老料榆木桌面沉重结实，经年累月的茶水渗入木纹，形成了深邃迷人的自然包浆。",
        "榫卯之间不著一钉一胶，全凭阴阳互补、张力支撑，这正是中国传统木作之大美。",
        "这瓶木香调既有老料老木的厚重沉静，又有生木破土的蓬勃朝气，令匠人由衷敬佩。"
    ],
    "guest_poetry": [
        "深夜听檐溜成韵，滴滴答答如击编钟，案前一炉静香，引人进入玄妙诗境。",
        "闭门苦读《楚辞》，九歌湘夫人令人神往，借这一抹出尘之静，神游八荒天地。",
        "雪后初霁，小窗寒澈，案头砚池初结薄冰，呵笔作绝句，静气充塞胸臆之间。",
        "暮色苍茫，渡口孤帆远影碧空尽，独立石矶，任凭晚风吹送这一缕深邃幽静。",
        "琴瑟调和，古调虽冷却韵味悠长，正如这沉静香调，非浮躁之人所能领会。",
        "秋水共长天一色，落霞与孤鹜齐飞，在极静的天地之中，心灵方得大自在。",
        "古寺钟声穿透层层暮霭，荡涤尘俗烦恼，借这抹幽香，洗净平生名利羁绊。",
        "竹林深处结茅庐，弹琴长啸伴明月，此等高洁诗怀，唯有至静至纯之香相称。",
        "夜读陶诗，心向南山，虽居闹市小筑，但得此深沉静气，已然泛舟世外桃源。",
        "细雨微茫打湿石阶苔痕，幽径无人，独自漫步其中，满怀皆是超然物外之思。",
        "研磨古墨，墨香深沉，与这静调香氛水乳交融，写就的诗卷自有一股凛然风骨。",
        "冬夜围炉守岁，听窗外雪落沙沙，炉火微红，这悠远静香守护着一室安详清福。",
        "红楼梦醒，繁华落尽，方知一切皆是镜花水月，唯有内心的安宁沉静最是真切。",
        "登高临风，千山暮雪，万里层云，在极度苍茫的静穆中，诗心与天地浑然合一。",
        "把酒问青天，明月几时有？独饮微醺之际，幽香拂袖，顿消千古离人之悲。",
        "古人佩香草以昭示高洁志节，我案头常伴这味深静，亦是为了坚守心中的那方净土。",
        "长夜将尽，晓色微露，在沉静的香雾中写下最后一联绝句，心中豁然开朗如晴空。"
    ],
    "guest_book": [
        "画案前悬挂四条屏长卷，苍松翠柏挺立悬崖，案头老木香与画中林海声气相通。",
        "大写意泼墨需趁湿渲染，墨气淋漓之间，老柏木香定住全场气息，力透纸背。",
        "画室背阴，老木画桌浸染墨汁数十年，散发出一股独特的沉郁松木与石砚古芳。",
        "构思《千里江山图》长卷，墨色铺开，松木脂香弥漫，胸中浩浩荡荡皆成山水。",
        "画枯木怪石，八大山人笔底孤傲苍凉，非得这一味冷峻刚劲的老木香才能助兴。",
        "用松烟墨与朱砂研磨调色，画出的秋山红叶苍茫厚重，老木沉香令画面更显静穆。",
        "画架上的白绢紧绷如鼓面，提笔悬腕欲落不落，闻得深沉木调，顿悟下笔之势。",
        "登泰山瞻仰秦汉古松，虬枝盘旋苍翠如铁，那股顶天立地的松骨之香令人肃然起敬。",
        "画雨后山岚，云雾在山涧间流动翻滚，老木画框散发的沉香赋予画面无尽的深远感。",
        "研石青石绿矿物颜料，石色古雅绚烂，配以沉稳木香压阵，大雅大美跃然纸上。",
        "作画如行军布阵，虚实相生，干湿浓淡，唯心神稳如老木泰山，方能运筹帷幄。",
        "冬日画雪竹，墨竹穿雪而出挺拔孤傲，老松木桌案散发出的暖木韵正给冬画添温。",
        "画案抽屉里藏着几块陈年松脂化石，偶尔取出摩挲，松香清冽，洗尽心头滞涩。",
        "挥毫写就大幅山水，收拾画具之时，满室木香静静萦绕，恍若身在画中林泉幽境。",
        "老树根经雕琢化作画案笔搁，枯荣相间，木性苍茫，每一次搁笔都是与天地的对话。",
        "画中点染三两古舟，老木船板在江波中摇晃，这沉木香气便是那抹最地道的江南古韵。",
        "用特制的老柏木炭条起草轮廓，炭黑入纸，木质坚韧，打下的画稿底子分外坚实。",
        "画室天窗透下斜阳，光柱照亮案头飘散的青烟，老木沉香在金色光晕里如诗如画。",
        "古人画山水以居以游，今人画山水以寄托旷达，这木香便是通向精神原乡的最好引路人。",
        "长卷题跋需用小楷，一笔一画沉着有力，老木镇纸压在纸角，字随香动，气象万千。",
        "江南水乡处处是灵感，而南窗这瓶深邃木调，则赋予了灵感最厚重的骨骼与灵魂。",
        "收拾起狼毫宣纸，带上这瓶苍劲刚健的木质好香，明朝再战巨幅山水，定教丹青惊鬼神。"
    ],
    "guest_fruit": [
        "刚剥开一粒水灵灵的杨梅，紫红色的汁水染红了舌尖，小家伙乐得手舞足蹈。",
        "夏天在竹林凉亭里给孩子切哈密瓜，蜜糖般的甜香引得蜜蜂在身边转圈圈。",
        "秋天院子里的红柿子熟透了软软的，用小勺挖着喂孩子，小嘴吃得满是甜泥。",
        "带娃在果树底下摇落一地金黄的甜杏，捡起来用衣角擦擦就咬，满嘴清脆甘甜。",
        "小家伙今天背会了第一首儿歌，做妈妈的心里就像喝了一大碗冰糖雪梨汤一样甜。",
        "厨房熬煮蓝莓果酱，紫蓝色的果浆在锅里翻滚，整栋小楼都弥漫着诱人的果香。",
        "把新鲜苹果切成小兔子模样摆在盘子里，孩子高兴得舍不得吃，咯咯笑个不停。",
        "带孩子在乡间采摘野桑葚，小手小嘴染得乌紫，纯真的笑声在大自然里久久回荡。",
        "秋天的大石榴剥开来像一盘晶莹的玛瑙碎石，一把喂进嘴里，酸酸甜甜生津止渴。",
        "冬天在炉火上给小宝温热牛奶，扔进两片新鲜甜橘皮，奶香混合着橘香，温暖好喝。",
        "南窗的果香就像一位贴心慈爱的母亲，把四季成熟的水果蜜意全妥帖收拢在怀里。",
        "小家伙睡觉前总喜欢拽着我的衣角闻香，说闻着甜甜的果子香，夜里梦见糖果屋。",
        "做母亲虽然操劳辛苦，但只要看到孩子健康快乐成长，心里便盛开了一座甜美果园。",
        "带着这瓶装满欢声笑语的鲜果香水回家，给平凡踏实的小日子添上一大勺蜜糖滋味。"
    ]
}

def main():
    import dialogue_data_1
    import dialogue_data_2
    import dialogue_data_3

    # Patch in-memory and write back files
    # 1. dialogue_data_1
    dialogue_data_1.GUEST_WALK.extend(EXTRA_DIALOGUES["guest_walk"])
    dialogue_data_1.GUEST_STUDENT.extend(EXTRA_DIALOGUES["guest_student"])
    dialogue_data_1.GUEST_TEA.extend(EXTRA_DIALOGUES["guest_tea"])
    dialogue_data_1.GUEST_COMMUTER.extend(EXTRA_DIALOGUES["guest_commuter"])

    # 2. dialogue_data_2
    dialogue_data_2.GUEST_AFTERNOON.extend(EXTRA_DIALOGUES["guest_afternoon"])
    dialogue_data_2.GUEST_NIGHT.extend(EXTRA_DIALOGUES["guest_night"])
    dialogue_data_2.GUEST_FLOWER.extend(EXTRA_DIALOGUES["guest_flower"])
    dialogue_data_2.GUEST_ARTISAN.extend(EXTRA_DIALOGUES["guest_artisan"])

    # 3. dialogue_data_3
    dialogue_data_3.GUEST_POETRY.extend(EXTRA_DIALOGUES["guest_poetry"])
    dialogue_data_3.GUEST_BOOK.extend(EXTRA_DIALOGUES["guest_book"])
    dialogue_data_3.GUEST_FRUIT.extend(EXTRA_DIALOGUES["guest_fruit"])

    all_lists = {
        "guest_walk": (dialogue_data_1.GUEST_WALK, "dialogue_data_1.py"),
        "guest_student": (dialogue_data_1.GUEST_STUDENT, "dialogue_data_1.py"),
        "guest_tea": (dialogue_data_1.GUEST_TEA, "dialogue_data_1.py"),
        "guest_commuter": (dialogue_data_1.GUEST_COMMUTER, "dialogue_data_1.py"),
        "guest_afternoon": (dialogue_data_2.GUEST_AFTERNOON, "dialogue_data_2.py"),
        "guest_night": (dialogue_data_2.GUEST_NIGHT, "dialogue_data_2.py"),
        "guest_flower": (dialogue_data_2.GUEST_FLOWER, "dialogue_data_2.py"),
        "guest_artisan": (dialogue_data_2.GUEST_ARTISAN, "dialogue_data_2.py"),
        "guest_poetry": (dialogue_data_3.GUEST_POETRY, "dialogue_data_3.py"),
        "guest_book": (dialogue_data_3.GUEST_BOOK, "dialogue_data_3.py"),
        "guest_fruit": (dialogue_data_3.GUEST_FRUIT, "dialogue_data_3.py"),
    }

    print("Checking counts after patch:")
    for k, (lst, src) in all_lists.items():
        unique_cnt = len(set(lst))
        print(f" - {k}: {len(lst)} lines (unique: {unique_cnt})")
        if len(lst) != 100 or unique_cnt != 100:
            print(f"ERROR: {k} did not match 100 unique lines!")
            return

    # Write formatted dialogue_data files
    import os
    base_dir = os.path.dirname(__file__)

    def save_file(filename, guest_vars):
        path = os.path.join(base_dir, filename)
        with open(path, 'w', encoding='utf-8') as f:
            f.write("# -*- coding: utf-8 -*-\n")
            f.write(f'""" Auto-generated: {filename} with 100 lines per guest """\n\n')
            for var_name, lst in guest_vars.items():
                f.write(f"{var_name} = [\n")
                for line in lst:
                    escaped = line.replace('\\', '\\\\').replace('"', '\\"')
                    f.write(f'    "{escaped}",\n')
                f.write("]\n\n")
        print(f"Saved {path}")

    save_file("dialogue_data_1.py", {
        "GUEST_WALK": dialogue_data_1.GUEST_WALK,
        "GUEST_STUDENT": dialogue_data_1.GUEST_STUDENT,
        "GUEST_TEA": dialogue_data_1.GUEST_TEA,
        "GUEST_COMMUTER": dialogue_data_1.GUEST_COMMUTER
    })

    save_file("dialogue_data_2.py", {
        "GUEST_AFTERNOON": dialogue_data_2.GUEST_AFTERNOON,
        "GUEST_NIGHT": dialogue_data_2.GUEST_NIGHT,
        "GUEST_FLOWER": dialogue_data_2.GUEST_FLOWER,
        "GUEST_ARTISAN": dialogue_data_2.GUEST_ARTISAN
    })

    save_file("dialogue_data_3.py", {
        "GUEST_POETRY": dialogue_data_3.GUEST_POETRY,
        "GUEST_BOOK": dialogue_data_3.GUEST_BOOK,
        "GUEST_FRUIT": dialogue_data_3.GUEST_FRUIT
    })

    print("All dialogue data files updated successfully!")

if __name__ == '__main__':
    main()
