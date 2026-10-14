"""Detailed handmade construction after revision1 silhouette/scale inspection.
Separate semantic parts stay editable; additions have a visible construction role.
"""
# Correct the preview floor only; it is never exported to the game.
o=bpy.data.objects.get('ENV_ground')
if o:o.location.x=-10;o.location.y=4
landmark('wagon')
# Bent ribs sit under a stitched canvas skin; rims, lashes and scalloped front edge.
for i in range(12):
 x=-1.67+i*.30;z=2.55+2.15*math.sqrt(max(0,1-(x/1.83)**2))
 if i in [0,11]:continue
 shape=[(x-.145,z),(x+.145,z),(x+.14,z-.20),(x+.06,z-.30),(x-.06,z-.30),(x-.14,z-.20)]
 extrude('canvas_front_scallop_'+str(i),shape,-2.29,.055,'plaster')
for y in [-1.68,-.56,.56,1.68]:
 pipe('canvas_stitched_seam',[( -1.86*math.cos(i*math.pi/28),y,2.56+2.18*math.sin(i*math.pi/28)) for i in range(29)],.014,'timber',5)
for x in [-1.77,1.77]:
 for y in [-1.95,-.95,.05,1.05,2.05]:
  rod('side_stanchion',(x,y,1.30),(x,y,2.59),.09,'timber')
  torus('tie_eye',(x+(.06 if x>0 else -.06),y,2.34),.075,.024,'iron','X',16,6)
  pipe('canvas_lashing',[(x,y-.08,2.59),(x+.10,y,2.3),(x,y+.08,2.56)],.02,'timber',6)
 for j in range(3):box('plank_joint',(x+.077*(1 if x>0 else -1),.1,1.46+j*.23),(.012,4.12,.018),'iron',.005)
for i in range(8):box('bed_plank',(-1.49+i*.425,0,1.43),(.412,4.45,.06),'timber',.012)
for y in [-1.58,1.58]:
 for x in [-2.27,2.27]:
  rod('hubcap',(x-.04,y,.79),(x+.04,y,.79),.105,'brass',12)
  for i in range(8):
   a=i*math.pi/4;rod('rim_pin',(x,y+.63*math.cos(a),.79+.63*math.sin(a)),(x+.035,y+.63*math.cos(a),.79+.63*math.sin(a)),.025,'iron',6)
# Open cargo bay lets baskets and tied rolls read from the front.
barrel('cargo_barrel',.93,1.20,1.45,.46,1.03)
barrel('cargo_smallbarrel',-1.09,1.28,1.45,.34,.78)
for i,(x,y,z,r,h) in enumerate([(-.62,.73,1.46,.43,.85),(.0,1.48,1.46,.41,.91),(-.64,1.00,2.25,.31,.62)]):sack('cargo_sack_'+str(i),x,y,z,r,h)
for i in range(4):jar('cargo_jar_'+str(i),-.9+i*.49,-.36,1.46,.19,.52,'tileLight' if i%2 else 'canvas')
basket('front_basket',.85,-1.24,1.46,.52,.48)
for i in range(15):
 a=i*2.39996;rr=.36*math.sqrt((i+.5)/15);fruit('basket_fruit',.85+rr*math.cos(a),-1.24+rr*math.sin(a),1.91+random.random()*.15,.12)
# Fold-out vendor counter and stepped footboard are grounded, not floating boxes.
box('fold_counter',(0,-2.35,1.80),(2.75,.70,.17),'timber',.04)
for x in [-1.12,1.12]:rod('counter_strut',(x,-1.88,1.34),(x,-2.60,1.73),.065,'iron')
box('footstep',(0,-2.51,.66),(2.18,.55,.15),'timber',.04)
for x in [-.80,.80]:rod('step_hanger',(x,-2.10,1.3),(x,-2.52,.69),.045,'iron')
lantern('front_lantern',1.55,-2.40,2.36)
pipe('lantern_hook',[(1.70,-2.15,3.03),(1.73,-2.43,3.13),(1.55,-2.47,3.03)],.035,'iron')
# Curved sign with relief brass coin, no flat sign pretending to be a window.
extrude('trade_sign',[(-.88,2.55),(-.75,2.88),(0,2.98),(.75,2.88),(.88,2.55),(.74,2.40),(-.74,2.40)],-2.40,.12,'canvas')
torus('coin_emblem',(0,-2.43,2.68),.18,.034,'brass','Y',24,6)
rod('coin_stroke',(0,-2.46,2.43),(0,-2.46,2.91),.022,'brass',6)
landmark('market')
# Scalloped thick cloth and physical tie cords lead the eye to the stocked stall.
for i in range(20):
 x=-3.04+i*.32;z=3.18+.74*math.sin(math.pi*(x+3.2)/6.4)
 extrude('valance',[ (x-.16,z),(x+.16,z),(x+.16,z-.25),(x+.10,z-.36),(x-.10,z-.36),(x-.16,z-.25)],-2.18,.05,'canvas')
for x in [-2.8,2.8]:
 rod('awning_prop',(x,-1.85,1.99),(x,-2.52,2.72),.058,'timber')
 for y in [-1.85,1.85]:
  rod('knee_brace',(x,y,2.41),(x+(.60 if x<0 else -.6),y,3.13),.075,'timber')
  pipe('canopy_tie',[(x-.10,y,3.31),(x-.12,y-.08,2.96),(x+.12,y+.06,2.90),(x+.10,y,3.25)],.026,'plaster')
for i in range(12):box('counter_board',(-2.49+i*.454,-1.45,1.2),(.437,.87,.07),'timber',.02)
for i,(x,y,r) in enumerate([(-2.02,-1.46,.42),(-.96,-1.45,.42),(.08,-1.45,.41),(1.12,-1.45,.41)]):
 basket('goods_basket_'+str(i),x,y,1.25,r,.35)
 for j in range(13):
  a=j*2.39996;rr=r*.74*math.sqrt((j+.5)/13);fruit('goods_'+str(i)+'_'+str(j),x+rr*math.cos(a),y+rr*math.sin(a),1.57+random.random()*.14,.10,'tileLight' if i%2==0 else 'brass')
for i in range(4):jar('counter_jar',2.12+(i%2)*.26,-1.60+(i//2)*.3,1.25,.15,.40,'canvas')
for i in range(8):jar('rear_pottery',-2.09+i*.57,1.48,1.72,.20,.44+(i%3)*.07,'plaster' if i%3 else 'tile')
for x in [-2.18,-.7,.78,2.18]:
 jar('lower_storage_pot',x,1.22,.02,.38,.91,'tileLight');torus('pot_handle',(x+.30,1.20,.56),.17,.034,'timber','Y',16,6)
for i in range(5):
 x=-1.82+i*.80;rod('utensil_hanger',(x,.80,2.74),(x,.80,2.49),.02,'iron',6)
 rod('utensil_handle',(x,.80,2.46),(x,.80,2.11),.032,'timber',6)
 if i%2:torus('pan_rim',(x,.80,1.97),.18,.028,'iron','Y',20,6);rod('pan_body',(x,.82,1.97),(x,.86,1.97),.16,'iron',20)
 else:rod('ladle_neck',(x,.80,2.13),(x,.80,1.99),.025,'iron',6);vessel('ladle_cup',(x,.80,1.84),[(.03,0),(.13,.10),(.13,.16),(.10,.16),(.08,.09)],'brass',12)
rod('hanging_bar',(-2.46,.80,2.74),(2.46,.80,2.74),.055,'timber')
barrel('market_barrel',2.64,.58,0,.40,.95)
sack('market_sack',-2.54,.64,0,.40,.84)
lantern('market_lantern',-2.79,-1.98,2.17)
landmark('assembly')
# Blockout side inspection showed a cap-to-post gap; complete its load path.
for x in [-1.35,1.35]:rod('notice_post_extension',(x,2.65,2.88),(x,2.65,3.22),.12,'timber')
rod('notice_cap_support',(-1.59,2.65,3.18),(1.59,2.65,3.18),.105,'timber')
rod('notice_ridge',(0,2.14,3.48),(0,3.12,3.48),.09,'timber')
# Low hearth cavity, radial split logs and broad coping stones, visible from play height.
vessel('hearth_ash',(0,.40,.035),[(1.16,0),(1.16,.08)],'iron',32,False)
for i in range(12):
 a=i*math.pi/6;rr=.93;box('hearth_inner_stone',(rr*math.cos(a),.4+rr*math.sin(a),.31),(.37,.39,.37),'stone',.075)
for i in range(5):
 a=i*.67;rod('split_firewood',(-.71*math.cos(a),.4-.71*math.sin(a),.27+i*.028),(.71*math.cos(a),.4+.71*math.sin(a),.27+i*.028),.10,'timber',9)
for i in range(14):
 a=i*2.399;rr=.7*math.sqrt((i+.5)/14);fruit('cold_ember',rr*math.cos(a),.4+rr*math.sin(a),.19,.08,'tile')
for x in [-2.6,2.6]:
 for i in range(4):box('bench_plank',(x+(-.22+i*.145),0,.89),(.134,3.08,.07),'timber',.018)
 box('bench_back',(x+( -.33 if x<0 else .33),0,1.28),(.12,3.05,.39),'timber',.03)
 for y in [-1.18,1.18]:rod('bench_back_post',(x,y,.64),(x+(-.33 if x<0 else .33),y,1.51),.055,'timber')
 for y in [-1.4,1.4]:torus('bench_iron_pin',(x,y,.928),.055,.017,'iron',segments=12,minor=5)
# Hand-cut tiled cap preserves the visible underside rather than covering the board.
for side in [-1,1]:
 for j in range(3):
  for i in range(5):
   x0=.04+i*.31;y0=2.13+j*.34
   surface('notice_roof_tile',lambda u,v,s=side,xx=x0,yy=y0:(s*(xx+.34*u),yy+.39*v,3.55-.46*((xx+.34*u)/1.66)+.11*((xx+.34*u)/1.66)**2+.08+.037*math.sin(math.pi*v)),4,4,'tileLight' if (i+j)%4==0 else 'tile',.06)
for x in [-1.39,1.39]:box('notice_frame',(x,2.49,2.09),(.12,.13,1.58),'timber',.035)
for z in [1.28,2.87]:box('notice_frame',(0,2.49,z),(2.88,.14,.12),'timber',.035)
for i in range(7):box('notice_board_joint',(-1.20+i*.40,2.53,2.07),(.014,.02,1.39),'iron',0)
for i,(x,z,w,h) in enumerate([(-.75,2.24,.73,.72),(.30,2.27,1.0,.72),(-.61,1.56,.73,.38),(.48,1.55,.67,.4)]):
 surface('pinned_parchment',lambda u,v,xx=x,zz=z,ww=w,hh=h:(xx+(u-.5)*ww,2.40-.025*math.sin(u*math.pi)*math.sin(v*math.pi),zz+(v-.5)*hh),3,3,'plaster',.018)
 for dx,dz in [(-w*.38,h*.39),(w*.38,h*.39)]:rod('notice_pin',(x+dx,2.40,z+dz),(x+dx,2.35,z+dz),.036,'brass',8)
 for j in range(3):box('notice_ink',(x,2.37,z+.10-j*.12),(w*.58,.012,.016),'timber',0)
torus('compass_emblem',(.30,2.32,2.27),.23,.027,'brass','Y',24,6)
for x in [-1.25,1.25]:rod('notice_knee',(x,2.65,2.72),(x+(.29 if x<0 else -.29),2.65,3.34),.07,'timber')
lantern('notice_lantern',1.53,2.26,2.09)
jar('water_jar',-1.85,2.12,0,.44,.97,'canvas')
torus('jar_handle',(-1.47,2.12,.66),.20,.055,'timber','Y',20,6)
# Rope-wrapped packs at the end of a bench: readable expedition use.
for x in [-2.45,2.50]:sack('resting_pack',x,.85,.93,.26,.49)
landmark('smithYard')
for x in [-2,2]:rod('rear_roof_support',(x,1.55,2.80),(x,1.55,3.56),.13,'timber')
for x in [-2,2]:
 for y in [-1.35,1.55]:
  box('stone_foot',(x,y,.25),(.40,.42,.45),'stone',.06)
  rod('knee',(x,y,2.22),(x+(.51 if x<0 else -.51),y,2.96 if y<0 else 3.59),.084,'timber')
for y in [-1.42,1.52]:rod('roof_beam',(-2.23,y,2.81 if y<0 else 3.44),(2.23,y,2.81 if y<0 else 3.44),.12,'timber')
for i in range(9):
 for j in range(8):
  x0=-2.45+i*.54;y0=-1.69+j*.45
  surface('overlap_clay_tile',lambda u,v,xx=x0,yy=y0:(xx+.57*u,yy+.51*v,2.90+.75*((yy+.51*v+1.72)/3.65)+.10*math.sin(math.pi*((xx+.57*u+2.45)/4.9))+.065+.065*math.sin(u*math.pi)),4,3,'tileLight' if (i+j)%5==0 else 'tile',.075)
for i in range(9):
 x=-2.18+i*.54;rod('under_eave_rafter',(x,-1.60,2.72),(x,1.74,3.39),.065,'timber')
# Real hanging tool wall and recessed shelf arrangement beneath the low roof.
for z in [1.45,2.40]:box('tool_rail',(0,1.36,z),(3.52,.10,.16),'timber',.02)
for i in range(8):
 x=-1.52+i*.43;rod('tool_peg',(x,1.32,2.39),(x,1.14,2.39),.033,'iron',6)
 rod('tool_handle',(x,1.17,2.31),(x,1.17,1.65+(i%2)*.12),.039,'timber',8)
 if i%3==0:box('hammer_head',(x,1.17,2.20),(.31,.15,.14),'iron',.028)
 elif i%3==1:extrude('axe_head',[(x-.04,2.2),(x+.21,2.29),(x+.29,2.07),(x+.02,2.01)],1.09,.14,'iron')
 else:torus('spanner_jaw',(x,1.15,2.23),.12,.028,'iron','Y',16,6)
for i in range(6):box('workbench_plank',(-1.50+i*.60,.83,1.13),(.58,.90,.07),'timber',.018)
for i in range(4):jar('oils',-.9+i*.39,.94,1.18,.12,.29,'brass')
rod('lying_hammer',(-.73,.48,1.2),(.05,.48,1.2),.045,'timber',8);box('lying_hammer_head',(.10,.48,1.23),(.17,.34,.16),'iron',.024)
vessel('anvil_stump',(1.22,-.81,.24),[(.40,0),(.42,.20),(.39,.55),(.35,.65)],'timber',16,False)
extrude('anvil',[(.56,1.38),(1.92,1.38),(1.80,1.21),(1.40,1.15),(1.27,.99),(1.51,.91),(.91,.91),(1.06,1.08),(.92,1.23),(.57,1.25)],-.98,.38,'iron')
barrel('water_barrel',-1.35,-.69,.24,.37,.79)
torus('spare_wheel',(-1.14,1.37,.73),.48,.068,'timber','Y',32,8)
for i in range(8):
 a=i*math.pi/4;rod('spare_spoke',(-1.14,1.37,.73),(-1.14+.43*math.cos(a),1.37,.73+.43*math.sin(a)),.024,'timber',6)
lantern('repair_lantern',-1.93,-1.49,2.05)
landmark('supplyYard')
for x in [-1.96,1.96]:
 for y in [-1.48,1.48]:
  rod('canopy_brace',(x,y,2.29),(x+(.49 if x<0 else -.49),y,3.15),.071,'timber')
  torus('rope_wrap',(x,y,2.8),.14,.022,'plaster',segments=16,minor=6)
for y in [-1.78,1.78]:
 pipe('cloth_edge',[( -2.22+4.44*i/24,y,2.98+.63*math.sin(math.pi*i/24)) for i in range(25)],.025,'plaster',6)
for i in range(15):
 x=-2.08+i*.29;z=2.98+.63*math.sin(math.pi*(x+2.22)/4.44)
 extrude('cloth_valance',[(x-.14,z),(x+.14,z),(x+.14,z-.18),(x+.07,z-.27),(x-.07,z-.27),(x-.14,z-.18)],-1.82,.045,'canvas')
for i in range(10):box('floor_plank',(-1.92+i*.426,0,.28),(.411,3.46,.045),'timber',.012)
for row,z in enumerate([.72,1.37,2.02]):
 for i in range(6):
  x=-1.50+i*.60
  if row==0:jar('supply_pottery',x,1.19,z,.23,.48,'tileLight' if i%2 else 'canvas')
  elif row==1:sack('shelf_grain',x,1.19,z,.23,.46)
  else:jar('small_provisions',x,1.19,z,.17,.38,'plaster' if i%2 else 'tile')
barrel('front_barrel',1.27,-.58,.28,.42,.88)
barrel('small_keg',1.10,.46,.28,.33,.69)
for i,(x,y,z,r,h) in enumerate([(-1.28,-.59,.29,.39,.85),(-.49,-.51,.29,.41,.92),(-.88,-.36,1.07,.29,.58)]):sack('supply_sack_'+str(i),x,y,z,r,h)
basket('supply_basket',.16,.15,.29,.34,.42)
for i in range(7):fruit('stored_produce',.16+.22*math.cos(i*2.399),.15+.22*math.sin(i*2.399),.68,.115,'brass')
lantern('supply_lantern',1.97,-1.67,2.10)
extrude('supply_sign',[(-.68,2.56),(.68,2.56),(.78,2.38),(.63,2.21),(-.63,2.21),(-.78,2.38)],-1.84,.10,'plaster')
for i in [-1,0,1]:
 rod('wheat_stem',(i*.2,-1.90,2.28),(i*.2+.07,-1.90,2.49),.012,'timber',6)
 for j in range(3):fruit('wheat_grain',i*.2+.035*j,-1.92,2.34+.05*j,.032,'brass')
normalize_normals();result=audit()
