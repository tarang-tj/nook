const ITEMS = ["Twin bed", "Desk", "Bookshelf", "Mini fridge", "Dresser", "Chair", "Bike"];

export function Marquee() {
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {ITEMS.map((item) => (
          <span key={item} className="marquee-item">
            {item}
          </span>
        ))}
        {ITEMS.map((item) => (
          <span key={`${item}-copy`} className="marquee-item is-dup">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
