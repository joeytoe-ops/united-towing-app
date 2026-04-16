export const PIN = "united149";
export const TAX = 0.08375;
export const CC_FEE = 0.045;

export const PARTNERS = [
  "JC Auto","Gabe Citgo","Karls Auto Body","Tasca Ford","Hartsdale Mobil",
  "RDI Property Group","NFA Towing","German Car","Mancuso Auto Body",
  "Cruz Control Auto","Vasco Tech Center","Performance Auto",
  "Preferred Auto Service","Sal's Auto","Ferry Auto","Yonkers Auto Gallery",
  "Renzo Auto","Tierney Auto","Caldarola Auto Body",
  "Frank Donato Construction","Lenny's Auto"
];

export const SVC = [
  { k:"towing", l:"Towing" },{ k:"waiting", l:"Waiting Time" },
  { k:"winch", l:"Winch" },{ k:"road_service", l:"Road Service" },
  { k:"gate_fee", l:"Gate Fee" },{ k:"admin_fee", l:"Admin Fee" },
  { k:"storage", l:"Storage" },{ k:"mileage", l:"Mileage" },
  { k:"special_equip", l:"Special Equipment" },{ k:"cleanup", l:"Clean Up" },
  { k:"speedy_dry", l:"Speedy Dry" },{ k:"goa", l:"GOA" }
];

export const PAY = ["Cash","Zelle","Check","Credit Card","Invoice Later","Pending Insurance"];
export const ST = { PAID:"paid", UNPAID:"unpaid", MISSING:"missing" };

/*  NEW COLUMN MAP (clean sheet layout)
    A=Job#  B=Date  C=Time  D=Description  E=Customer  F=Phone
    G=Pickup  H=Dropoff  I=Color  J=Make  K=Model  L=Year  M=Plate
    N=Price  O=Payment  P=Status  Q=Notes  R=VIN  S=Services(JSON)  T=Extended(JSON)
    Indices: 0-19 (20 columns)
*/
export const COL = {
  ID:0, DATE:1, TIME:2, DESC:3, CUST:4, PHONE:5,
  PICKUP:6, DROPOFF:7, COLOR:8, MAKE:9, MODEL:10, YEAR:11, PLATE:12,
  PRICE:13, PAYMENT:14, STATUS:15, NOTES:16, VIN:17, SVC:18, EXT:19
};
