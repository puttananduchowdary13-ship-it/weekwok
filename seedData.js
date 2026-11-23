// name|minutes|serves|category|ingredient:amount  (T tiffin, M rice & mains, C curries, S snacks, D desserts)
const RECIPE_ROWS = `Idli|30|3|T|Idli batter:300,Cooking oil:2
Dosa|25|3|T|Dosa batter:300,Cooking oil:15
Puri|30|3|T|Wheat flour:200,Cooking oil:60
Parota|35|3|T|Maida:300,Cooking oil:30,Milk:50,Sugar:5
Chapati|25|3|T|Wheat flour:200,Cooking oil:10
Upma|20|3|T|Sooji:150,Onions:50,Green chillies:10,Cooking oil:15,Curry leaves:2
Semiya Upma|20|3|T|Semiya:150,Onions:50,Carrots:50,Cooking oil:15,Curry leaves:2
Gunta Ponganalu|25|3|T|Dosa batter:300,Onions:50,Green chillies:10,Cooking oil:20
Vada|30|3|T|Urad dal:150,Onions:50,Green chillies:10,Cooking oil:80,Curry leaves:2
Bonda|30|3|T|Potatoes:250,Besan:100,Green chillies:10,Cooking oil:80
Pongal|30|3|T|Rice:150,Moong dal:50,Ghee:20
Aloo Paratha|30|3|T|Wheat flour:300,Potatoes:300,Butter:20
Masala Omelette|10|2|T|Eggs:3,Onions:50,Tomatoes:50,Cooking oil:10
Plain Rice|20|4|M|Rice:300
Lemon Rice|20|3|M|Rice:200,Lemons:1,Peanuts:20,Curry leaves:2,Cooking oil:15
Tomato Rice|25|3|M|Rice:200,Tomatoes:250,Onions:50,Cooking oil:20
Veg Pulav|30|3|M|Basmati rice:200,Green peas:50,Carrots:50,Beans:50,Ghee:15
Paneer Rice|30|3|M|Basmati rice:200,Paneer:150,Capsicum:50,Cooking oil:20
Veg Dum Biryani|60|4|M|Basmati rice:300,Carrots:100,Beans:100,Green peas:50,Onions:150,Curd:100,Biryani masala:20,Ghee:30
Chicken Biryani|75|4|M|Basmati rice:300,Chicken:500,Onions:200,Curd:100,Biryani masala:25,Ghee:30
Khichdi|30|3|M|Rice:150,Moong dal:75,Turmeric:2,Ghee:15
Curd Rice|20|3|M|Rice:150,Curd:300
Dal|30|4|C|Toor dal:150,Turmeric:2,Onions:50,Cooking oil:10
Sambar|40|4|C|Toor dal:100,Sambar powder:10,Tamarind:10,Carrots:50,Tomatoes:50,Onions:50
Mixed Veg Curry|30|4|C|Carrots:100,Beans:100,Green peas:50,Potatoes:100,Onions:100,Tomatoes:100,Cooking oil:20
Aloo Curry|25|4|C|Potatoes:400,Onions:100,Tomatoes:100,Turmeric:2,Cooking oil:20
Brinjal Curry|30|4|C|Brinjal:400,Onions:100,Tomatoes:100,Cooking oil:25
Cabbage Curry|25|4|C|Cabbage:400,Green peas:50,Onions:50,Cooking oil:15
Cauliflower Curry|30|4|C|Cauliflower:400,Onions:100,Tomatoes:100,Cooking oil:20
Beans Curry|25|4|C|Beans:300,Onions:50,Cooking oil:15
Capsicum Curry|25|4|C|Capsicum:300,Onions:100,Tomatoes:100,Cooking oil:20
Paneer Butter Masala|35|4|C|Paneer:400,Butter:50,Tomatoes:300,Onions:100,Ginger-garlic paste:15,Garam masala:5
Gongura Curry|30|4|C|Gongura:250,Onions:100,Green chillies:15,Cooking oil:25
Curd (side)|1|4|C|Curd:150
Mango Pickle|1|4|C|Mango pickle:30
Gongura Pickle|1|4|C|Gongura pickle:30
Veg Manchuria|30|3|S|Cabbage:200,Carrots:50,Maida:60,Capsicum:50,Cooking oil:80
Pakodi|25|3|S|Besan:150,Onions:150,Green chillies:10,Cooking oil:80
Mixed Fritters|25|3|S|Besan:150,Cabbage:100,Carrots:50,Cooking oil:80
Samosa|45|4|S|Maida:200,Potatoes:250,Green peas:50,Cooking oil:100
Waffle|20|2|S|Maida:150,Milk:150,Eggs:1,Butter:30,Sugar:20
Murukulu|45|5|S|Rice flour:250,Urad dal:30,Butter:20,Cooking oil:100
Mixture|30|6|S|Besan:200,Peanuts:100,Curry leaves:3,Cooking oil:100
Potato Chips|20|3|S|Potatoes:400,Cooking oil:100
Chekkalu|40|5|S|Rice flour:250,Chana dal:30,Cooking oil:100
Noodles|20|2|S|Noodles:200,Carrots:50,Cabbage:50,Cooking oil:15
Popcorn|10|3|S|Corn kernels:80,Butter:15
Mirchi Bajji|25|3|S|Green chillies:100,Besan:100,Cooking oil:80
Punugulu|25|3|S|Idli batter:300,Onions:50,Green chillies:10,Cooking oil:80
Sweet Corn|10|2|S|Corn kernels:150,Butter:15,Lemons:1
Masala Peanuts|15|3|S|Peanuts:150,Besan:30,Onions:30,Green chillies:5,Cooking oil:20
Tea|5|1|S|Milk:150,Tea powder:3,Sugar:10
Coffee|5|1|S|Milk:150,Coffee powder:3,Sugar:10
Buttermilk|3|2|S|Curd:100
Rava Kesari|20|4|D|Sooji:150,Sugar:150,Ghee:50
Semiya Payasam|25|4|D|Semiya:75,Milk:750,Sugar:100,Ghee:15
Gajar Halwa|45|4|D|Carrots:500,Milk:300,Sugar:120,Ghee:40
Gulab Jamun|45|5|D|Maida:100,Milk:150,Sugar:300,Ghee:60
Besan Laddu|30|6|D|Besan:250,Sugar:150,Ghee:100
Sweet Pongal|35|4|D|Rice:100,Moong dal:50,Jaggery:150,Ghee:40
Rice Kheer|40|4|D|Rice:50,Milk:750,Sugar:100,Ghee:10
Peanut Chikki|20|6|D|Peanuts:200,Jaggery:150,Ghee:10`;

// name|unit|quantity|low level|expires in N days (blank = never)|price in rupees per kg, L or piece
const PANTRY_ROWS = `Rice|g|3000|500||55
Basmati rice|g|1000|300||120
Wheat flour|g|2000|500||45
Maida|g|1000|300||45
Besan|g|500|200||90
Rice flour|g|500|200||60
Sooji|g|500|200||55
Semiya|g|400|150||70
Idli batter|g|600|200|2|80
Dosa batter|g|600|200|2|80
Toor dal|g|1000|300||150
Urad dal|g|500|150||140
Chana dal|g|250|100||100
Moong dal|g|500|150||120
Onions|g|1500|500|10|40
Tomatoes|g|600|300|2|50
Potatoes|g|1500|500|14|30
Green chillies|g|100|30|5|80
Lemons|pcs|4|2|7|5
Carrots|g|500|200|8|60
Beans|g|300|150|4|80
Cabbage|g|500|200|6|35
Cauliflower|g|0|200|4|60
Brinjal|g|400|200|4|50
Capsicum|g|200|100|5|80
Green peas|g|0|100|5|160
Gongura|g|0|100|2|60
Chicken|g|0|300|2|220
Paneer|g|200|200|3|380
Milk|ml|2000|500|2|60
Curd|ml|500|200|3|80
Butter|g|200|50|20|520
Ghee|g|300|100||600
Eggs|pcs|6|3|8|7
Cooking oil|ml|1000|250||140
Sugar|g|1500|300||45
Tea powder|g|250|50||500
Coffee powder|g|200|50||700
Peanuts|g|300|100||130
Noodles|g|400|100||120
Corn kernels|g|250|100||100
Tamarind|g|200|50||200
Curry leaves|g|20|5|5|200
Garam masala|g|50|10||900
Biryani masala|g|100|20||800
Sambar powder|g|100|20||400
Turmeric|g|100|20||250
Ginger-garlic paste|g|100|30|25|200
Mango pickle|g|300|50||300
Gongura pickle|g|200|50||350
Jaggery|g|300|100||80`;

const recipes = RECIPE_ROWS.split('\n').map((line) => {
  const [name, minutes, serves, category, ingredientList] = line.split('|');
  const ingredients = ingredientList.split(',').map((pair) => {
    const [ingredient, amount] = pair.split(':');
    return { name: ingredient, qty: Number(amount) };
  });
  return { name, minutes: Number(minutes), serves: Number(serves), category, ingredients };
});

const pantry = PANTRY_ROWS.split('\n').map((line) => {
  const [name, unit, qty, low, expiresInDays, price] = line.split('|');
  return { name, unit, qty: Number(qty), low: Number(low), expiresInDays: expiresInDays ? Number(expiresInDays) : null, price: Number(price) };
});

module.exports = { recipes, pantry };
